// Cross-check the paper.nu parser's output against the catalog's <a>-tag
// linked course codes (ground truth). Reports per-course coverage and
// samples the failure modes so we know what a tailored parser needs to fix.
//
// Usage: node scripts/analyze-parser-gaps.mjs

import * as esbuild from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const IN_PATH = resolve(HERE, "data/catalog-courses.json");
const OUT_PATH = resolve(HERE, "data/parser-gaps-report.json");
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

function collectCourseNodes(node, acc) {
	if (!node) return;
	if (node.kind === "course") {
		acc.add(`${node.subject} ${node.number}-${node.section}`);
	} else if (node.kind === "all" || node.kind === "any") {
		for (const c of node.of) collectCourseNodes(c, acc);
	} else if (node.kind === "when") {
		collectCourseNodes(node.condition, acc);
		collectCourseNodes(node.then, acc);
	}
}

function summarizeNode(node) {
	if (!node) return null;
	if (node.kind === "all" || node.kind === "any") {
		return { kind: node.kind, of: node.of.map(summarizeNode) };
	}
	if (node.kind === "course") return `${node.subject} ${node.number}-${node.section}`;
	if (node.kind === "consent") return `consent:${node.source}`;
	if (node.kind === "standing") return `standing:${node.level}${node.orAbove ? "+" : ""}`;
	if (node.kind === "topic") return `topic:${node.topic}`;
	if (node.kind === "level-wildcard")
		return `level-wildcard:${node.subjects.join("|")}-${node.levels.join("|")}`;
	if (node.kind === "placement") return `placement:${node.exam}`;
	if (node.kind === "program") return `program:${node.relation}:${node.name}`;
	if (node.kind === "program-membership")
		return `program-membership:${node.negated ? "!" : ""}${node.program}`;
	if (node.kind === "when")
		return { when: summarizeNode(node.condition), then: summarizeNode(node.then) };
	if (node.kind === "raw") return `raw:${node.text}`;
	if (node.kind === "none") return "none";
	if (node.kind === "gpa") return `gpa:${node.min}`;
	return node.kind;
}

function normalizeCode(code) {
	const m = code.match(/^([A-Z][A-Z0-9_]*)\s+(\d+)(?:-(\d+|[A-Z]+))?\s*$/);
	if (!m) return code;
	return `${m[1]} ${m[2]}-${m[3] ?? "0"}`;
}

const SAMPLES = 15;

async function main() {
	console.log("Bundling parser…");
	const parsePrereq = await loadParser();
	console.log("Loading catalog…");
	const catalog = JSON.parse(await readFile(IN_PATH, "utf8"));
	const withPrereqs = catalog.courses.filter((c) => c.prereqRawText);
	console.log(`Courses with prereq line: ${withPrereqs.length}`);

	const buckets = {
		"full-coverage-no-warn": [],
		"full-coverage-with-warn": [],
		"missing-some": [],
		"missing-all": [],
		"no-linked-no-warn": [],
		"no-linked-with-warn": [],
		"raw-fallback": [],
	};

	let totalLinked = 0;
	let totalCovered = 0;

	for (const c of withPrereqs) {
		const parentSubject = c.code.split(/\s+/)[0];
		const { parsed, warnings } = parsePrereq(c.prereqRawText, parentSubject);

		const linked = new Set(c.prereqLinkedCourses.map(normalizeCode).filter((s) => /\s/.test(s)));
		const parsedCodes = new Set();
		collectCourseNodes(parsed, parsedCodes);

		const covered = [...linked].filter((code) => parsedCodes.has(code));
		const missed = [...linked].filter((code) => !parsedCodes.has(code));
		totalLinked += linked.size;
		totalCovered += covered.length;

		const summary = {
			code: c.code,
			prereqRawText: c.prereqRawText,
			linked: [...linked],
			parsedCodes: [...parsedCodes],
			missed,
			extraInParse: [...parsedCodes].filter((c) => !linked.has(c)),
			warnings,
			parsedSummary: summarizeNode(parsed),
		};

		let bucket;
		if (parsed && parsed.kind === "raw") bucket = "raw-fallback";
		else if (linked.size === 0)
			bucket = warnings.length > 0 ? "no-linked-with-warn" : "no-linked-no-warn";
		else if (missed.length === 0)
			bucket = warnings.length > 0 ? "full-coverage-with-warn" : "full-coverage-no-warn";
		else if (covered.length === 0) bucket = "missing-all";
		else bucket = "missing-some";

		buckets[bucket].push(summary);
	}

	console.log(`\nTotal linked codes (truth): ${totalLinked}`);
	console.log(`Covered in parsed tree     : ${totalCovered} (${((totalCovered / totalLinked) * 100).toFixed(1)}%)`);

	console.log("\n=== Bucket sizes ===");
	for (const [b, arr] of Object.entries(buckets)) {
		console.log(`  ${b.padEnd(28)} ${arr.length}`);
	}

	const trimmed = Object.fromEntries(
		Object.entries(buckets).map(([b, arr]) => [b, { total: arr.length, samples: arr.slice(0, SAMPLES) }]),
	);

	await writeFile(
		OUT_PATH,
		JSON.stringify(
			{
				generatedAt: new Date().toISOString(),
				totalWithPrereqs: withPrereqs.length,
				totalLinkedCodes: totalLinked,
				totalCoveredInParse: totalCovered,
				buckets: trimmed,
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
