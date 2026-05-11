// Head-to-head: paper.nu parser vs. catalog-aware parser. Runs both over
// every catalog prereq line, scores by linked-code coverage, and writes a
// JSON report with samples for each disagreement bucket.
//
// Usage: node scripts/compare-parsers.mjs

import * as esbuild from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseCatalogPrereq } from "./catalog-parser.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const IN_PATH = resolve(HERE, "data/catalog-courses.json");
const OUT_PATH = resolve(HERE, "data/parser-compare.json");
const PARSER_ENTRY = resolve(REPO, "src/content/prereqs/parser/index.ts");

async function loadPaperParser() {
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
		const key = node.section ? `${node.subject} ${node.number}-${node.section}` : `${node.subject} ${node.number}`;
		acc.add(key);
	} else if (node.kind === "all" || node.kind === "any") {
		for (const c of node.of) collectCourseNodes(c, acc);
	} else if (node.kind === "when") {
		collectCourseNodes(node.condition, acc);
		collectCourseNodes(node.then, acc);
	}
}

function summarizeNode(node, depth = 0) {
	if (!node) return null;
	if (depth > 6) return "…";
	if (node.kind === "all" || node.kind === "any") {
		return { kind: node.kind, of: node.of.map((n) => summarizeNode(n, depth + 1)) };
	}
	if (node.kind === "course") {
		const mods = [];
		if (node.minGrade) mods.push(`≥${node.minGrade}`);
		if (node.equivalentOk) mods.push("≈");
		if (node.concurrent) mods.push(`concur:${node.concurrent}`);
		return `${node.subject} ${node.number}-${node.section}${mods.length ? `[${mods.join(",")}]` : ""}`;
	}
	if (node.kind === "consent") return `consent:${node.source}`;
	if (node.kind === "standing") return `standing:${node.level}${node.orAbove ? "+" : ""}`;
	if (node.kind === "topic") return `topic:${node.topic.slice(0, 40)}`;
	if (node.kind === "level-wildcard")
		return `lvl-wild:${node.subjects.join("|")}-${node.levels.join("|")}`;
	if (node.kind === "placement") return `placement:${node.exam}`;
	if (node.kind === "program") return `program:${node.relation}:${node.name}`;
	if (node.kind === "program-membership")
		return `program-membership:${node.negated ? "!" : ""}${node.program}`;
	if (node.kind === "when")
		return { when: summarizeNode(node.condition, depth + 1), then: summarizeNode(node.then, depth + 1) };
	if (node.kind === "raw") return `raw:${node.text.slice(0, 60)}`;
	if (node.kind === "none") return "none";
	if (node.kind === "gpa") return `gpa:${node.min}`;
	return node.kind;
}

function isTrailCode(linkedCode, prereqRawText) {
	// A linked code that appears only inside a trail/equivalence clause is
	// not actually a prereq; the catalog still anchors it. Drop these from
	// the ground-truth set so we don't penalize parsers for correctly
	// ignoring them.
	const trailMarkers = [
		"may not receive credit for both",
		"credit not allowed for both",
		"credit not given for both",
		"not to be taken for credit with",
		"this course is equivalent to",
		"students who have taken",
		"students cannot receive credit",
		"students cannot recieve credit",
		"students may not receive credit",
		"weinberg college limits",
		"may be repeated",
		"taught with ",
		"must be taken with the same professor",
		"additional prerequisites may apply",
	];
	const lower = prereqRawText.toLowerCase();
	const idx = lower.indexOf(linkedCode.toLowerCase());
	if (idx === -1) return false;
	for (const marker of trailMarkers) {
		const m = lower.indexOf(marker);
		if (m !== -1 && idx > m) return true;
	}
	return false;
}

function score(parsed, linkedCodes, prereqRawText, parentSubject) {
	const parsedCodes = new Set();
	collectCourseNodes(parsed, parsedCodes);
	// Carry-subject so bare-code anchors (e.g. "217-3") expand to "<subj> 217-3"
	// for comparison purposes. We walk the linked-codes in the order they
	// appeared in the raw text so the most-recent subject wins.
	const truth = [];
	let currentSubject = parentSubject;
	for (const raw of linkedCodes) {
		if (isTrailCode(raw, prereqRawText)) continue;
		const m = /^([A-Z][A-Z0-9_]*)\s+/.exec(raw);
		if (m) {
			currentSubject = m[1];
			truth.push(raw);
		} else if (currentSubject && /^\d/.test(raw)) {
			truth.push(`${currentSubject} ${raw}`);
		} else {
			truth.push(raw);
		}
	}
	const covered = truth.filter((c) => parsedCodes.has(c));
	const missed = truth.filter((c) => !parsedCodes.has(c));
	return { parsedCodes: [...parsedCodes], truth, covered, missed };
}

const SAMPLES = 12;

async function main() {
	console.log("Bundling paper.nu parser…");
	const parsePaper = await loadPaperParser();
	console.log("Loading catalog…");
	const catalog = JSON.parse(await readFile(IN_PATH, "utf8"));
	const withPrereqs = catalog.courses.filter((c) => c.prereqRawText);
	console.log(`Courses with prereq line: ${withPrereqs.length}`);

	const totals = {
		paper: { fullCoverage: 0, anyMiss: 0, codesTruth: 0, codesCovered: 0, rawFallback: 0, nullParse: 0, freeform: 0, topicLeaf: 0 },
		catalog: { fullCoverage: 0, anyMiss: 0, codesTruth: 0, codesCovered: 0, rawFallback: 0, nullParse: 0, freeform: 0, topicLeaf: 0 },
	};

	const buckets = {
		"both-full": [],
		"paper-full-catalog-miss": [],
		"catalog-full-paper-miss": [],
		"both-miss": [],
	};

	const newParserWarnings = new Map();

	for (const c of withPrereqs) {
		const parentSubject = c.code.split(/\s+/)[0];
		const paperRes = parsePaper(c.prereqRawText, parentSubject);
		const catalogRes = parseCatalogPrereq(c.prereqSegments, parentSubject);

		const paperScore = score(paperRes.parsed, c.prereqLinkedCourses, c.prereqRawText, parentSubject);
		const catalogScore = score(catalogRes.parsed, c.prereqLinkedCourses, c.prereqRawText, parentSubject);

		const update = (label, parsed, warnings, sc) => {
			const t = totals[label];
			t.codesTruth += sc.truth.length;
			t.codesCovered += sc.covered.length;
			if (sc.truth.length > 0) {
				if (sc.missed.length === 0) t.fullCoverage++;
				else t.anyMiss++;
			}
			if (parsed && parsed.kind === "raw") t.rawFallback++;
			if (parsed === null) t.nullParse++;
			if (warnings.some((w) => w === "freeform" || w.startsWith?.("topic:"))) t.freeform++;
			let hasTopic = false;
			const walk = (n) => {
				if (!n) return;
				if (n.kind === "topic") hasTopic = true;
				else if (n.kind === "all" || n.kind === "any") n.of.forEach(walk);
				else if (n.kind === "when") {
					walk(n.condition);
					walk(n.then);
				}
			};
			walk(parsed);
			if (hasTopic) t.topicLeaf++;
		};
		update("paper", paperRes.parsed, paperRes.warnings, paperScore);
		update("catalog", catalogRes.parsed, catalogRes.warnings, catalogScore);

		for (const w of catalogRes.warnings) {
			const key = w.startsWith("topic:") ? "topic:*" : w;
			newParserWarnings.set(key, (newParserWarnings.get(key) ?? 0) + 1);
		}

		if (paperScore.truth.length === 0) continue;
		const paperFull = paperScore.missed.length === 0;
		const catalogFull = catalogScore.missed.length === 0;
		let bucket;
		if (paperFull && catalogFull) bucket = "both-full";
		else if (paperFull && !catalogFull) bucket = "paper-full-catalog-miss";
		else if (!paperFull && catalogFull) bucket = "catalog-full-paper-miss";
		else bucket = "both-miss";

		buckets[bucket].push({
			code: c.code,
			prereqRawText: c.prereqRawText,
			truth: paperScore.truth,
			paper: {
				parsedCodes: paperScore.parsedCodes,
				missed: paperScore.missed,
				warnings: paperRes.warnings,
				parsed: summarizeNode(paperRes.parsed),
			},
			catalog: {
				parsedCodes: catalogScore.parsedCodes,
				missed: catalogScore.missed,
				warnings: catalogRes.warnings,
				parsed: summarizeNode(catalogRes.parsed),
			},
		});
	}

	const fmt = (t, name) => {
		const cov = ((t.codesCovered / t.codesTruth) * 100).toFixed(1);
		console.log(
			`${name.padEnd(8)}  linked-code coverage: ${t.codesCovered}/${t.codesTruth} (${cov}%)   full: ${t.fullCoverage}   anyMiss: ${t.anyMiss}   raw: ${t.rawFallback}   null: ${t.nullParse}   topicLeaf: ${t.topicLeaf}`,
		);
	};
	console.log("");
	fmt(totals.paper, "paper");
	fmt(totals.catalog, "catalog");
	console.log("\nBucket sizes:");
	for (const [b, arr] of Object.entries(buckets)) console.log(`  ${b.padEnd(28)} ${arr.length}`);

	console.log("\nTop new-parser warnings:");
	const topWarn = [...newParserWarnings.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
	for (const [w, n] of topWarn) console.log(`  ${n.toString().padStart(4)} × ${w}`);

	const trimmed = Object.fromEntries(
		Object.entries(buckets).map(([b, arr]) => [b, { total: arr.length, samples: arr.slice(0, SAMPLES) }]),
	);

	await writeFile(
		OUT_PATH,
		JSON.stringify(
			{ generatedAt: new Date().toISOString(), totals, buckets: trimmed, topNewParserWarnings: topWarn },
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
