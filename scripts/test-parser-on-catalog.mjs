// Run the paper.nu prereq parser against every catalog course that has a
// "Prerequisite:" line, and report how well it copes with the natural-language
// catalog prose.
//
// Input:  scripts/data/catalog-courses.json (from scrape-catalog.mjs)
// Output: scripts/data/parser-on-catalog-report.json
//         + a console summary.
//
// Usage: node scripts/test-parser-on-catalog.mjs

import * as esbuild from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const IN_PATH = resolve(HERE, "data/catalog-courses.json");
const OUT_PATH = resolve(HERE, "data/parser-on-catalog-report.json");
const PARSER_ENTRY = resolve(REPO, "src/content/prereqs/parser/index.ts");

async function loadParser() {
	const result = await esbuild.build({
		entryPoints: [PARSER_ENTRY],
		bundle: true,
		format: "esm",
		platform: "neutral",
		target: "es2022",
		write: false,
	});
	const tmpFile = join(tmpdir(), `prereq-parser-${Date.now()}.mjs`);
	await writeFile(tmpFile, result.outputFiles[0].text);
	return (await import(pathToFileURL(tmpFile).href)).parsePrereq;
}

function categorize(parsed, warnings) {
	if (parsed === null) return "null";
	if (parsed.kind === "raw") return "raw";
	if (warnings.length > 0) return "structured-with-warnings";
	return "structured";
}

function collectUnknownLeaves(node, acc) {
	if (!node) return;
	if (node.kind === "raw") acc.push(node);
	else if (node.kind === "all" || node.kind === "any") {
		for (const c of node.of) collectUnknownLeaves(c, acc);
	} else if (node.kind === "when") {
		collectUnknownLeaves(node.condition, acc);
		collectUnknownLeaves(node.then, acc);
	}
}

const SAMPLES_PER_CATEGORY = 12;

async function main() {
	console.log("Bundling parser via esbuild…");
	const parsePrereq = await loadParser();

	console.log("Loading catalog…");
	const catalog = JSON.parse(await readFile(IN_PATH, "utf8"));
	const withPrereqs = catalog.courses.filter((c) => c.prereqRawText);
	console.log(`Courses with prereq line: ${withPrereqs.length}`);

	const counts = { structured: 0, "structured-with-warnings": 0, raw: 0, null: 0 };
	const samples = { structured: [], "structured-with-warnings": [], raw: [], null: [] };
	const unknownLeafTexts = new Map(); // text → count

	for (const c of withPrereqs) {
		const parentSubject = c.code.split(/\s+/)[0];
		const { parsed, warnings } = parsePrereq(c.prereqRawText, parentSubject);
		const cat = categorize(parsed, warnings);
		counts[cat]++;

		if (parsed && parsed.kind !== "raw") {
			const leaves = [];
			collectUnknownLeaves(parsed, leaves);
			for (const l of leaves) {
				unknownLeafTexts.set(l.text, (unknownLeafTexts.get(l.text) ?? 0) + 1);
			}
		}

		const bucket = samples[cat];
		if (bucket.length < SAMPLES_PER_CATEGORY) {
			bucket.push({
				code: c.code,
				prereqRawText: c.prereqRawText,
				prereqLinkedCourses: c.prereqLinkedCourses,
				parsed,
				warnings,
			});
		}
	}

	const topUnknownLeaves = [...unknownLeafTexts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 25)
		.map(([text, count]) => ({ count, text }));

	const total = withPrereqs.length;
	const pct = (n) => `${((n / total) * 100).toFixed(1)}%`;
	console.log("\n=== Parse outcomes ===");
	console.log(`  structured            : ${counts.structured} (${pct(counts.structured)})`);
	console.log(`  structured+warnings   : ${counts["structured-with-warnings"]} (${pct(counts["structured-with-warnings"])})`);
	console.log(`  raw fallback          : ${counts.raw} (${pct(counts.raw)})`);
	console.log(`  null                  : ${counts.null} (${pct(counts.null)})`);
	console.log(`\nDistinct unknown {kind:"raw"} leaves inside structured trees: ${unknownLeafTexts.size}`);
	console.log("Top 10 most common unknown leaves:");
	for (const { count, text } of topUnknownLeaves.slice(0, 10)) {
		console.log(`  ${count.toString().padStart(4)} × ${JSON.stringify(text)}`);
	}

	await writeFile(
		OUT_PATH,
		JSON.stringify(
			{
				generatedAt: new Date().toISOString(),
				totalWithPrereqs: total,
				counts,
				topUnknownLeaves,
				samples,
			},
			null,
			2,
		),
	);
	console.log(`\nWrote ${OUT_PATH}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
