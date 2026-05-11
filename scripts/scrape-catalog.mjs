// Scrape Northwestern's online catalog for course descriptions + prerequisites.
//
// Output: scripts/data/catalog-courses.json
//   { scrapedAt, sources, counts, errors, courses: [...] }
//
// Each course entry:
//   {
//     code:                "COMP_SCI 150-0",
//     title:               "Fundamentals of Computer Programming 1.5",
//     units:               "1 Unit"  | null,
//     description:         "...",
//     prereqRawText:       "Prerequisite: COMP_SCI 110-0 or ..."  | null,
//     prereqLinkedCourses: ["COMP_SCI 110-0", "COMP_SCI 111-0", ...],
//     prereqSegments:      [{kind:"text",value:"Prerequisite: "},
//                            {kind:"course",code:"COMP_SCI 110-0"},
//                            {kind:"text",value:" or "}, ...],
//     distroTags:          ["Formal Studies Distro Area", ...],
//     sourceUrl:           "https://catalogs.northwestern.edu/undergraduate/courses-az/comp_sci/"
//   }
//
// Usage: node scripts/scrape-catalog.mjs

import { JSDOM } from "jsdom";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://catalogs.northwestern.edu";
const CATALOG_ROOTS = [
	"/undergraduate/courses-az/",
	"/tgs/courses-az/",
	"/sps/courses-az/undergraduate/",
	"/sps/courses-az/graduate/",
	"/law/courses/",
];

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, "data/catalog-courses.json");

const CONCURRENCY = 6;
const RETRIES = 2;
const RETRY_DELAY_MS = 2000;
const USER_AGENT = "pencil-nu-catalog-scraper/1.0 (+https://github.com/kev1n/pencil.nu)";

async function fetchHtml(url) {
	let lastErr;
	for (let attempt = 0; attempt <= RETRIES; attempt++) {
		try {
			const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return await res.text();
		} catch (err) {
			lastErr = err;
			if (attempt < RETRIES) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
		}
	}
	throw new Error(`fetch failed for ${url}: ${lastErr?.message ?? lastErr}`);
}

function extractSubjectLinks(root, html) {
	const dom = new JSDOM(html);
	const out = new Set();
	for (const a of dom.window.document.querySelectorAll(`a[href^="${root}"]`)) {
		const href = a.getAttribute("href");
		if (!href || href === root) continue;
		if (!href.endsWith("/")) continue; // skip .pdf, .xml, etc.
		const rest = href.slice(root.length).replace(/\/$/, "");
		if (!rest || rest.includes("/")) continue; // direct child only
		out.add(href);
	}
	return [...out].sort();
}

const CODE_RE = /^([A-Z][A-Z0-9_]*\s+\d[\dA-Z._-]*)/;
const TRAILING_PAREN_RE = /^(.*?)\s*\(([^()]+)\)\s*$/;
const PREREQ_LABEL_RE = /^Prerequisites?\s*:/i;

const norm = (s) => s.replace(/\s+/g, " ").trim();

// Walk the prereq <span> in DOM order, emitting an alternating segment list:
//   {kind: "course", code} for each <a class="bubblelink code"> (or .code)
//   {kind: "text",   value} for everything else
// Adjacent text segments are merged; whitespace is normalized inside each
// segment but boundaries between course / text are preserved exactly.
function extractSegments(root) {
	const segs = [];
	const pushText = (raw) => {
		const v = raw.replace(/\s+/g, " ");
		if (!v) return;
		const last = segs[segs.length - 1];
		if (last && last.kind === "text") last.value += v;
		else segs.push({ kind: "text", value: v });
	};
	const walk = (node) => {
		for (const child of node.childNodes) {
			if (child.nodeType === 3 /* TEXT_NODE */) {
				pushText(child.nodeValue ?? "");
			} else if (child.nodeType === 1 /* ELEMENT_NODE */) {
				const el = /** @type {Element} */ (child);
				if (
					el.tagName === "A" &&
					(el.classList.contains("bubblelink") || el.classList.contains("code"))
				) {
					const code = norm(el.textContent ?? "");
					if (code) segs.push({ kind: "course", code });
					else pushText(el.textContent ?? "");
				} else {
					walk(el);
				}
			}
		}
	};
	walk(root);
	for (const s of segs) if (s.kind === "text") s.value = s.value.replace(/\s+/g, " ");
	if (segs.length && segs[0].kind === "text") segs[0].value = segs[0].value.replace(/^\s+/, "");
	if (segs.length && segs[segs.length - 1].kind === "text") {
		segs[segs.length - 1].value = segs[segs.length - 1].value.replace(/\s+$/, "");
		if (!segs[segs.length - 1].value) segs.pop();
	}
	return segs;
}

function parseCourseBlock(block) {
	const titleEl = block.querySelector(".courseblocktitle");
	if (!titleEl) return null;
	const titleText = norm(titleEl.textContent ?? "");

	let code = "";
	let title = titleText;
	let units = null;

	const codeMatch = titleText.match(CODE_RE);
	if (codeMatch) {
		code = codeMatch[1];
		const rest = titleText.slice(code.length).trim();
		const parenMatch = rest.match(TRAILING_PAREN_RE);
		if (parenMatch) {
			title = parenMatch[1].trim();
			units = parenMatch[2].trim();
		} else {
			title = rest;
		}
	}

	const descEl = block.querySelector(".courseblockdesc");
	const description = descEl ? norm(descEl.textContent ?? "") : "";

	let prereqRawText = null;
	let prereqLinkedCourses = [];
	let prereqSegments = null;
	const distroTags = [];

	for (const ex of block.querySelectorAll(".courseblockextra")) {
		const txt = norm(ex.textContent ?? "");
		if (!txt) continue;
		if (PREREQ_LABEL_RE.test(txt)) {
			prereqRawText = txt;
			prereqSegments = extractSegments(ex);
			const codes = new Set();
			for (const s of prereqSegments) if (s.kind === "course") codes.add(s.code);
			prereqLinkedCourses = [...codes];
		} else if (ex.querySelector("em")) {
			distroTags.push(norm(ex.querySelector("em").textContent ?? ""));
		}
	}

	return { code, title, units, description, prereqRawText, prereqLinkedCourses, prereqSegments, distroTags };
}

function parseSubjectPage(url, html) {
	const dom = new JSDOM(html);
	const out = [];
	for (const block of dom.window.document.querySelectorAll("div.courseblock")) {
		const parsed = parseCourseBlock(block);
		if (parsed && parsed.code) out.push({ ...parsed, sourceUrl: url });
	}
	return out;
}

async function withConcurrency(items, limit, worker, label) {
	const results = new Array(items.length);
	let cursor = 0;
	let done = 0;
	const total = items.length;
	async function run() {
		while (cursor < items.length) {
			const idx = cursor++;
			try {
				results[idx] = { ok: await worker(items[idx]) };
			} catch (err) {
				results[idx] = { error: err.message, item: items[idx] };
			}
			done++;
			if (process.stdout.isTTY) {
				process.stdout.write(`\r  ${label}: ${done}/${total}`);
			}
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
	if (process.stdout.isTTY) process.stdout.write("\n");
	else console.log(`  ${label}: ${done}/${total}`);
	return results;
}

async function main() {
	console.log("Discovering subject pages…");
	const subjectUrls = [];
	for (const root of CATALOG_ROOTS) {
		const html = await fetchHtml(BASE + root);
		const links = extractSubjectLinks(root, html);
		console.log(`  ${root} → ${links.length} subjects`);
		for (const href of links) subjectUrls.push(BASE + href);
	}
	console.log(`Total subject pages: ${subjectUrls.length}\n`);

	console.log("Fetching subject pages…");
	const perSubject = await withConcurrency(
		subjectUrls,
		CONCURRENCY,
		async (url) => parseSubjectPage(url, await fetchHtml(url)),
		"subjects",
	);

	const courses = [];
	const errors = [];
	for (const r of perSubject) {
		if (r.ok) courses.push(...r.ok);
		else errors.push({ url: r.item, error: r.error });
	}

	const withPrereqs = courses.filter((c) => c.prereqRawText).length;
	console.log(`\nParsed: ${courses.length} courses (${withPrereqs} with prereq line); errors: ${errors.length}`);

	await mkdir(dirname(OUT_PATH), { recursive: true });
	await writeFile(
		OUT_PATH,
		JSON.stringify(
			{
				scrapedAt: new Date().toISOString(),
				sources: CATALOG_ROOTS.map((r) => BASE + r),
				counts: {
					subjects: subjectUrls.length,
					courses: courses.length,
					coursesWithPrereqs: withPrereqs,
					errors: errors.length,
				},
				errors,
				courses,
			},
			null,
			2,
		),
	);
	console.log(`Wrote ${OUT_PATH}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
