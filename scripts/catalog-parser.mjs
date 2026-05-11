// Catalog-aware prereq parser.
//
// Input:  { prereqSegments, parentSubject }  where prereqSegments is the
//         token stream emitted by scrape-catalog.mjs's extractSegments() —
//         an alternating list of { kind: "course", code } / { kind: "text",
//         value } that preserves the catalog's <a class="bubblelink code">
//         boundaries.
//
// Output: { parsed: PrereqNode | null, warnings: string[] } matching the
//         schema in src/content/prereqs/types.ts.
//
// Stages: trailStrip → wrapperStrip → tokenize → parse → emit.
//
// Design note: COURSE tokens come straight from the HTML anchors, so the
// parser never has to recognize course codes from prose. That fixes the
// entire class of bugs around letter-suffix sections (BUSCOM 601S),
// embedded titles (BUSCOM 601S Business Associations), slash alternatives
// (ITALIAN 133-3 / ITALIAN 134-3), and most level-wildcard collisions.

// === Trail / wrapper patterns ============================================

const TRAIL_RES = [
	/\bcredit\s+(?:not\s+(?:allowed|given)|may\s+not\s+be\s+(?:earned|received)|cannot\s+be\s+(?:earned|received))\s+for\s+both\b/i,
	/\bmay\s+not\s+receive\s+credit\s+for\s+both\b/i,
	/\bstudents?\s+who\s+have\s+(?:taken|completed)\b/i,
	/\b(?:may|cannot)\s+be\s+repeated\b/i,
	/\b(?:may\s+)?not\s+to\s+be\s+(?:taken\s+for\s+credit\s+)?with\b/i,
	/\badditional\s+prerequisites?\s+may\s+apply\b/i,
	/\bweinberg\s+college\s+limits\b/i,
	/\bthis\s+course\s+is\s+equivalent\s+to\b/i,
	/\bmust\s+be\s+taken\s+with\s+the\s+same\s+professor\b/i,
	/\btaught\s+with\s+[A-Z][A-Z_]+\s+\d{3}/i,
	/\bcandidates?\s+who\s+seek\b/i,
	/\bstudents?\s+(?:cannot|may\s+not)\s+(?:receive|recieve)\s+credit\b/i,
];

// Wrapper patterns scrub leading prose without dropping the rest of the
// segment. Applied iteratively until no more match.
const WRAPPER_RES = [
	/^\s*(?:prerequisites?|pre-?reqs?|pre-?requisites?)\s*:?\s*/i,
	/^\s*students?\s+must\s+have\s+(?:successfully\s+)?completed\s*,?\s*/i,
	/^\s*students?\s+must\s+(?:successfully\s+)?complete\s*,?\s*/i,
	/^\s*students?\s+must\s+have\s*,?\s*/i,
	/^\s*students?\s+(?:should|must)\s+have\s+(?:taken|finished|passed)\s*,?\s*/i,
	/^\s*with\s+a\s+(?:grade\s+of\s+)?([ABCD][+\-]?)\s+or\s+(?:better|higher|above)\s*,?\s*/i,
	/^\s*(?:a\s+)?(?:grade\s+of\s+)?([ABCD][+\-]?)\s+or\s+(?:better|higher|above)\s+in\s+/i,
	/^\s*grade\s+of\s+at\s+least\s+([ABCD][+\-]?)\s+in\s+/i,
	/^\s*minimum\s+grade\s+(?:of\s+)?([ABCD][+\-]?)\s+in\s+/i,
	/^\s*completion\s+of\s*,?\s*/i,
	/^\s*successful\s+completion\s+of\s*,?\s*/i,
	/^\s*one\s+(?:of\s+the\s+following|of)\s*:?\s*/i,
	/^\s*any\s+(?:one\s+)?of\s+the\s+following\s*:?\s*/i,
	/^\s*all\s+(?:\w+\s+)?of\s+the\s+following\s*:?\s*/i,
	/^\s*(?:both\s+)?of\s+the\s+following\s*:?\s*/i,
	/^\s*prior\s+completion\s+of\s+(?:or\s+concurrent\s+enrollment\s+in\s+)?/i,
	/^\s*\d+\s+iterations?\s+of\s+/i,
	/^\s*basic\s+probability\s+theory\s*\(?/i,
	/^\s*grade\s+of\s+at\s+least\s+(?:a\s+)?([ABCD][+\-]?)\s+in\s+/i,
	// SPANISH / language-department phrasing
	/^\s*(?:second\s+language\s+learners|spanish\s+heritage\s+learners)\s+(?:currently\s+)?(?:enrolled\s+in|enrolled)\s+(?:or\s+(?:who\s+)?have\s+taken\s+(?:and\s+passed\s+)?)?/i,
	/^\s*students?\s+(?:must\s+)?(?:currently\s+)?be\s+enrolled\s+in\s*,?\s*(?:or\s+have\s+taken\s+(?:and\s+passed\s+)?)?/i,
	/^\s*students?\s+(?:need\s+to|must)\s+have\s+taken\s*,?\s*/i,
	/^\s*(?:who\s+)?have\s+taken\s+(?:and\s+passed\s+)?/i,
	/^\s*currently\s+enrolled\s+in\s*,?\s*/i,
];

// Phrases scrubbed mid-segment (don't truncate the segment).
const MID_STRIP_RES = [
	/\bto\s+(?:register|enroll)\s+(?:for|in)\s+this\s+course\.?/i,
	/\bto\s+enroll\.?/i,
	/\bto\s+take\s+this\s+course\.?/i,
	/\bis\s+(?:a\s+)?pre-?requisites?\s+for\s+this\s+course\.?/i,
	/\bare\s+pre-?requisites?\s+for\s+this\s+course\.?/i,
	/\bare\s+(?:both\s+)?prerequisites?\s+for\s+this\s+course\.?/i,
	/\b(?:successfully\s+)?(?:taking|completing|passing|completion\s+of)\b/i,
	// "one of the following:" / "all three of the following:" mid-clause —
	// after the operator that introduces them, the list follows.
	/\b(?:one|all|any|both|either)(?:\s+\w+)?\s+of\s+the\s+following\s*:?\s*/i,
	// "in" between AND/OR and a course-anchor leaks through as a "in" topic;
	// FILLER_RE_LIST drops the standalone topic so we don't need a mid-strip here.
];

// === Atom patterns (scanned inside text segments) ========================

// Order matters: longer / more specific patterns must come before shorter
// ones (e.g. MIN_GRADE before LPAREN, EQUIVALENT before OR, AND_OR before AND).
const KEYWORDS = [
	// modifiers — parenthesized grade matches must beat LPAREN
	{ tag: "MIN_GRADE", re: /\(\s*([ABCD][+\-]?)\s*or\s+(?:better|higher|above)\s*\)/iy, value: (m) => m[1].toUpperCase() },
	{ tag: "MIN_GRADE", re: /\(\s*minimum\s+grade\s+(?:of\s+)?([ABCD][+\-]?)\s*\)/iy, value: (m) => m[1].toUpperCase() },
	{ tag: "MIN_GRADE", re: /\bwith\s+a\s+(?:grade\s+of\s+)?([ABCD][+\-]?)\s*or\s+(?:better|higher|above)/iy, value: (m) => m[1].toUpperCase() },
	{ tag: "MIN_GRADE", re: /\bgrade\s+of\s+(?:at\s+least\s+)?([ABCD][+\-]?)\s+or\s+(?:better|higher|above)(?:\s+in)?\b/iy, value: (m) => m[1].toUpperCase() },
	{ tag: "MIN_GRADE", re: /\bgrade\s+of\s+at\s+least\s+([ABCD][+\-]?)(?:\s+in)?\b/iy, value: (m) => m[1].toUpperCase() },
	{ tag: "MIN_GRADE", re: /\bminimum\s+grade\s+(?:of\s+)?([ABCD][+\-]?)\b/iy, value: (m) => m[1].toUpperCase() },
	{ tag: "MIN_GRADE", re: /\(\s*([ABCD][+\-]?)\s*\)/iy, value: (m) => m[1].toUpperCase() },
	// equivalent — must beat OR (because it starts with "or")
	{ tag: "EQUIVALENT", re: /\bor\s+equivalent(?:\s+proficiency|\s+experience|\s+preparation|\s+background)?\b/iy },
	{ tag: "EQUIVALENT", re: /\bequivalent\s+(?:experience|preparation|background|proficiency)\b/iy },
	// concurrent — REQ must beat OK
	{ tag: "CONCURRENT_REQ", re: /\bmust\s+be\s+taken\s+concurrently\s+with\b/iy },
	{ tag: "CONCURRENT_REQ", re: /\bconcurrent\s+(?:registration|enrollment)\s+(?:required\s+)?(?:in|with)\b/iy },
	{ tag: "CONCURRENT_REQ", re: /\b(?:co-?requisites?|corequisites?)\s*:?\s*/iy },
	{ tag: "CONCURRENT_OK", re: /\b(?:may\s+be\s+taken\s+)?concurrently(?:\s+with)?\b/iy },
	// grouping / punctuation
	{ tag: "LPAREN", re: /\(/y },
	{ tag: "RPAREN", re: /\)/y },
	{ tag: "LBRACKET", re: /\[/y },
	{ tag: "RBRACKET", re: /\]/y },
	{ tag: "SEMI", re: /;/y },
	{ tag: "COMMA", re: /,/y },
	{ tag: "SLASH", re: /\s*\/\s*/y },
	// connectors — longer first
	{ tag: "AND_OR", re: /\band\s*\/\s*or\b/iy },
	{ tag: "AND", re: /\band\b/iy },
	{ tag: "OR", re: /\bor\b/iy },
	{ tag: "PLUS", re: /\s*\+\s*/y },
	{ tag: "AMP", re: /\s*&\s*/y },
	// consent
	{
		tag: "CONSENT",
		re: /\b(?:consent|permission|approval)\s+of\s+(?:the\s+)?(instructor|department|faculty|adviser|advisor|program\s+adviser|program\s+advisor)\b/iy,
		value: (m) => {
			const t = m[1].toLowerCase();
			if (t.startsWith("department")) return "department";
			if (t.includes("program")) return "program-adviser";
			if (t.startsWith("advisor") || t.startsWith("adviser")) return "program-adviser";
			if (t === "faculty") return "faculty";
			return "instructor";
		},
	},
	{
		tag: "CONSENT",
		re: /\b(?:instructor|department|faculty)\s+(?:consent|permission|approval)\b/iy,
		value: (m) => {
			const txt = m[0].toLowerCase();
			if (txt.startsWith("department")) return "department";
			if (txt.startsWith("faculty")) return "faculty";
			return "instructor";
		},
	},
	{ tag: "CONSENT", re: /\bby\s+application\s+only\b/iy, value: () => "application" },
	// standing
	{
		tag: "STANDING",
		re: /\b(senior|junior|sophomore|freshman|graduate|advanced|first[- ]?year|second[- ]?year)(?:\s+or\s+(senior|junior|sophomore|freshman|graduate|advanced|first[- ]?year|second[- ]?year))?\s+(?:standing|status|year)\b/iy,
		value: (m) => ({ level: normLevel(m[1]), or: m[2] ? normLevel(m[2]) : null }),
	},
	// level wildcard: "300-level X course" or "200-level course in X"
	{
		tag: "LEVEL_WILDCARD",
		re: /\b(\d{3})[- ]level\s+(?:course\s+in\s+)?([a-z][a-z &]*?)(?=\s+(?:or|and|,|;|\.|\(|$))/iy,
		value: (m) => ({ level: parseInt(m[1], 10), text: m[2].trim() }),
	},
	{
		tag: "LEVEL_WILDCARD",
		re: /\b(\d{3})[- ]level\s+course\b/iy,
		value: (m) => ({ level: parseInt(m[1], 10), text: null }),
	},
	// "None" as a complete answer
	{ tag: "NONE", re: /^\s*none\.?\s*$/iy },
	// "Vary depending on..." (raw)
	{
		tag: "RAW_VARY",
		re: /\bvary(?:ing|\s+by)\b.*$/iy,
		value: (m) => m[0],
	},
];

// Connector / filler prose that the tokenizer captures as TOPIC but
// carries no semantic value — drop, don't emit a topic node.
const FILLER_RE_LIST = [
	/^(this|the|a|an|also|all|both|either|neither|each|previous|prior|same|new|recommend|recommended)$/i,
	/^(medill|kellogg|sesp|weinberg|mccormick|bienen)$/i,
	/^(medill|kellogg|sesp|weinberg|mccormick|bienen)\s+students?$/i,
	/^non-?\w+\s+students?$/i,
	/^non-?\w+\s+(?:imc|cs|sps)\s+certificate\s+students?$/i,
	/^must\s+be\s+taken\b/i,
	/^must\s+have\b/i,
	/^should\s+have\b/i,
	/^are\s+(?:both\s+)?(?:strict|required|encouraged|recommended|suitable)$/i,
	/^is\s+(?:strict|required|encouraged|recommended)$/i,
	/^are\s+all\s+suitable$/i,
	/^prerequisites?\s+are\b/i,
	/^by\s+(?:successfully\s+)?(?:taking|completing|passing)\b/i,
	/^successfully\b/i,
	/^as\s+(?:a\s+)?(?:prerequisite|prerequisites)\b/i,
	/^to\s+(?:enroll|register|take)\b/i,
	/^before\b/i,
	/^prior\b/i,
	/^minimum\s+grade\b/i,
	/^in\b/i,
	/^at\b/i,
	/^of\b/i,
	/^for\b/i,
	/^equivalent$/i,
];

function isFillerTopic(text) {
	const t = text.trim();
	if (!t) return true;
	for (const re of FILLER_RE_LIST) if (re.test(t)) return true;
	return false;
}

function normLevel(s) {
	const t = s.toLowerCase().replace(/[-\s]/g, "");
	if (t === "firstyear") return "first-year";
	if (t === "secondyear") return "second-year";
	return s.toLowerCase();
}

// === Trail stripping ====================================================

function applyTrailStrip(segments) {
	// Walk segments; in each text segment find earliest trail-pattern hit.
	// If found, truncate that text segment's value and drop everything after.
	const out = [];
	for (const seg of segments) {
		if (seg.kind !== "text") {
			out.push(seg);
			continue;
		}
		let earliest = -1;
		for (const re of TRAIL_RES) {
			const m = re.exec(seg.value);
			if (m && (earliest === -1 || m.index < earliest)) earliest = m.index;
		}
		if (earliest === -1) {
			out.push(seg);
			continue;
		}
		const before = seg.value.slice(0, earliest).replace(/[.\s]+$/, "");
		if (before) out.push({ kind: "text", value: before });
		return out;
	}
	return out;
}

function applyWrapperStrip(segments, leadingGradeOut) {
	if (!segments.length) return segments;
	if (segments[0].kind !== "text") return segments;
	let v = segments[0].value;
	let changed = true;
	while (changed) {
		changed = false;
		for (const re of WRAPPER_RES) {
			const m = re.exec(v);
			if (m && m.index === 0) {
				if (m[1] && leadingGradeOut) leadingGradeOut.grade = m[1].toUpperCase();
				v = v.slice(m[0].length);
				changed = true;
			}
		}
	}
	const out = segments.slice();
	if (v.trim()) out[0] = { kind: "text", value: v };
	else out.shift();
	return out;
}

function applyMidStrip(segments) {
	return segments.map((s) => {
		if (s.kind !== "text") return s;
		let v = s.value;
		for (const re of MID_STRIP_RES) v = v.replace(re, " ");
		v = v.replace(/\s+/g, " ");
		return { kind: "text", value: v };
	});
}

// "X. Y" where Y starts a new prereq clause should act like a semicolon.
// We detect this by splitting any text segment containing ". " into
// pre / post and inserting a synthetic SEMI text segment, but only when
// the post part contains substantive content (a course follows, or a
// recognized atom).
function applyPeriodSplit(segments) {
	const out = [];
	for (let i = 0; i < segments.length; i++) {
		const s = segments[i];
		if (s.kind !== "text") {
			out.push(s);
			continue;
		}
		// Don't split a single trailing "." into a semi
		const parts = s.value.split(/\.\s+/);
		if (parts.length === 1) {
			out.push(s);
			continue;
		}
		for (let j = 0; j < parts.length; j++) {
			if (parts[j]) out.push({ kind: "text", value: parts[j] + (j < parts.length - 1 ? "." : "") });
			if (j < parts.length - 1) out.push({ kind: "text", value: " ; " }); // synthetic SEMI delimiter
		}
	}
	return out;
}

// === Tokenization =======================================================

function tokenizeSegments(segments) {
	const tokens = [];
	for (const seg of segments) {
		if (seg.kind === "course") {
			tokens.push({ tag: "COURSE", code: seg.code });
			continue;
		}
		let pos = 0;
		const txt = seg.value;
		while (pos < txt.length) {
			// skip whitespace
			const wsMatch = /\s+/y;
			wsMatch.lastIndex = pos;
			const ws = wsMatch.exec(txt);
			if (ws && ws.index === pos) {
				pos = wsMatch.lastIndex;
				continue;
			}

			let matched = null;
			for (const kw of KEYWORDS) {
				kw.re.lastIndex = pos;
				const m = kw.re.exec(txt);
				if (m && m.index === pos) {
					matched = { tag: kw.tag, raw: m[0], value: kw.value ? kw.value(m) : undefined };
					pos = kw.re.lastIndex;
					break;
				}
			}
			if (matched) {
				tokens.push(matched);
				continue;
			}

			// Accumulate a TOPIC chunk: read until we hit an operator/grouping
			// char or a recognized keyword.
			let topicStart = pos;
			while (pos < txt.length) {
				const c = txt[pos];
				if (c === "(" || c === ")" || c === "[" || c === "]" || c === "," || c === ";" || c === "/") break;
				// Check if a keyword starts here
				let kwHit = false;
				for (const kw of KEYWORDS) {
					if (kw.tag === "LPAREN" || kw.tag === "RPAREN" || kw.tag === "LBRACKET" || kw.tag === "RBRACKET" || kw.tag === "COMMA" || kw.tag === "SEMI" || kw.tag === "SLASH") continue;
					kw.re.lastIndex = pos;
					const m = kw.re.exec(txt);
					if (m && m.index === pos) {
						kwHit = true;
						break;
					}
				}
				if (kwHit) break;
				pos++;
			}
			const topic = txt.slice(topicStart, pos).trim();
			if (topic) tokens.push({ tag: "TOPIC", text: topic });
		}
	}
	return tokens;
}

// === Parser =============================================================

class TokenStream {
	constructor(tokens) {
		this.tokens = tokens;
		this.pos = 0;
	}
	peek(offset = 0) {
		return this.tokens[this.pos + offset];
	}
	eat() {
		return this.tokens[this.pos++];
	}
	match(tag) {
		const t = this.peek();
		if (t && t.tag === tag) {
			this.pos++;
			return t;
		}
		return null;
	}
	matchAny(...tags) {
		const t = this.peek();
		if (t && tags.includes(t.tag)) {
			this.pos++;
			return t;
		}
		return null;
	}
	eof() {
		return this.pos >= this.tokens.length;
	}
}

function preprocessTokens(tokens, parentSubject) {
	let out = [];
	// Carry-subject across bare-code anchors like `<a>217-3</a>` (the catalog
	// drops the subject when it's the same as the previous code's subject).
	let currentSubject = parentSubject ?? null;
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		// Drop punctuation-only TOPIC tokens (leftover ".", ",", etc.) that
		// leaked past tokenizer keyword detection.
		if (t.tag === "TOPIC" && /^[\s.,;:]+$/.test(t.text)) continue;
		// Drop filler TOPICs (connector / fluff phrases) early so they don't
		// pollute separator detection.
		if (t.tag === "TOPIC" && isFillerTopic(t.text)) continue;
		// COMMA followed by an explicit operator collapses (Oxford-style
		// "A, or B" / "A, and B"). The COMMA is stylistic.
		if (t.tag === "COMMA") {
			const next = tokens[i + 1];
			if (next && /^(OR|AND|AND_OR|AMP|PLUS|SLASH)$/.test(next.tag)) continue;
		}
		if (t.tag === "COURSE") {
			const m = /^([A-Z][A-Z0-9_]*)\s+/.exec(t.code);
			if (m) currentSubject = m[1];
			else if (currentSubject && /^\d/.test(t.code)) {
				t.code = `${currentSubject} ${t.code}`;
			}
		}
		out.push(t);
	}
	out = dropAnnotationParens(out);
	out = dropTitleRemnantsAfterCourse(out);
	return out;
}

// `(former)`, `(or NU Biology Placement Test)`, `(or concurrent enrollment)`,
// `(concurrent enrollment in X is sufficient)` — annotation parentheticals
// that don't actually contain a COURSE atom should be skipped wholesale so
// the surrounding expression keeps parsing.
function dropAnnotationParens(tokens) {
	const out = [];
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		if (t.tag !== "LPAREN") {
			out.push(t);
			continue;
		}
		// Find matching RPAREN
		let depth = 1;
		let j = i + 1;
		let hasCourse = false;
		while (j < tokens.length && depth > 0) {
			if (tokens[j].tag === "LPAREN") depth++;
			else if (tokens[j].tag === "RPAREN") depth--;
			else if (tokens[j].tag === "COURSE" && depth === 1) hasCourse = true;
			j++;
		}
		if (hasCourse || depth !== 0) {
			out.push(t);
			continue;
		}
		// Inside is annotation-only; check if it contains a single recognized
		// trailing-modifier kind (e.g. "(or equivalent)", "(C- or better)")
		// and emit just that modifier inline.
		const inner = tokens.slice(i + 1, j - 1);
		const mod = inner.find((tt) => MOD_TAGS.has(tt.tag));
		if (mod) out.push(mod);
		i = j - 1;
	}
	return out;
}

// `POLI_SCI 220-0 American Government and Politics` — after the course
// anchor, the catalog's <a> text already includes the code. The catalog's
// surrounding prose is the course title. When a TOPIC immediately follows
// a COURSE (no operator between), it's the title — drop it.
function dropTitleRemnantsAfterCourse(tokens) {
	const out = [];
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		out.push(t);
		if (t.tag !== "COURSE") continue;
		// Eat any number of TOPIC tokens following the course (a multi-word
		// title can split into TOPIC / AND / TOPIC chunks because of an
		// embedded "and"). We greedy-drop TOPIC and the AND/COMMA glue
		// between TOPICs, but only when the NEXT non-glue token after the
		// chain is a CONTINUATION-operator (OR/AND/COMMA/SEMI/RPAREN/...)
		// or end-of-stream — proving the chunk was a title and not real
		// content.
		let j = i + 1;
		while (j < tokens.length && tokens[j].tag === "TOPIC") {
			let k = j + 1;
			if (
				k < tokens.length &&
				(tokens[k].tag === "AND" || tokens[k].tag === "COMMA") &&
				tokens[k + 1] &&
				tokens[k + 1].tag === "TOPIC"
			) {
				j = k + 1; // skip TOPIC and the glue
				continue;
			}
			j++; // advance past the trailing TOPIC
			break;
		}
		if (j > i + 1) {
			const after = tokens[j];
			if (!after || ["OR", "AND", "COMMA", "SEMI", "RPAREN", "RBRACKET", "SLASH"].includes(after.tag)) {
				i = j - 1; // skip the chain
			}
		}
	}
	return out;
}

const SEP_TAGS = new Set(["COMMA", "AND", "OR", "AND_OR", "AMP", "PLUS", "SLASH"]);
const STOP_TAGS = new Set(["SEMI", "RPAREN", "RBRACKET"]);

function skipOrphans(ts) {
	while (true) {
		const t = ts.peek();
		if (!t) return;
		if (SEP_TAGS.has(t.tag)) {
			ts.eat();
			continue;
		}
		if (t.tag === "TOPIC" && isFillerTopic(t.text)) {
			ts.eat();
			continue;
		}
		return;
	}
}

function parseTokens(tokens, parentSubject, warnings) {
	const ts = new TokenStream(preprocessTokens(tokens, parentSubject));
	const node = parseOrSemi(ts, parentSubject, warnings);
	if (!ts.eof()) {
		const rest = ts.tokens.slice(ts.pos, ts.pos + 5).map((t) => t.tag).join(",");
		warnings.push(`trailing-tokens:${rest}`);
	}
	return node;
}

function parseOrSemi(ts, parentSubject, warnings) {
	const semiGroup = [];
	const FACTOR_TAGS = new Set([
		"COURSE",
		"CONSENT",
		"STANDING",
		"LEVEL_WILDCARD",
		"NONE",
		"RAW_VARY",
		"LPAREN",
		"LBRACKET",
		"TOPIC",
	]);
	while (!ts.eof()) {
		const before = ts.pos;
		const item = parseList(ts, parentSubject, warnings);
		if (item) semiGroup.push(item);
		// Recovery: consume the trailing run of tokens up to the next SEMI
		// or the next factor-start. Skip whole LPAREN groups whose content
		// has no novel course (most are annotations).
		while (!ts.eof()) {
			const t = ts.peek();
			if (!t) break;
			if (t.tag === "SEMI") {
				ts.eat();
				break;
			}
			if (FACTOR_TAGS.has(t.tag)) {
				// If LPAREN, peek ahead: skip if it'll parse as an empty/annotation group
				if (t.tag === "LPAREN") {
					let depth = 1;
					let k = ts.pos + 1;
					let sawCourseInside = false;
					while (k < ts.tokens.length && depth > 0) {
						if (ts.tokens[k].tag === "LPAREN") depth++;
						else if (ts.tokens[k].tag === "RPAREN") depth--;
						else if (ts.tokens[k].tag === "COURSE" && depth === 1) sawCourseInside = true;
						k++;
					}
					if (!sawCourseInside) {
						ts.pos = k; // skip the whole group
						continue;
					}
				}
				break;
			}
			ts.eat();
		}
		if (ts.pos === before) {
			// No forward progress — bail to avoid infinite loop
			break;
		}
	}
	if (semiGroup.length === 0) return null;
	if (semiGroup.length === 1) return semiGroup[0];
	return mergeAll(semiGroup);
}

function parseList(ts, parentSubject, warnings) {
	const items = [];
	const seps = []; // type for each gap between items: "AND" | "OR" | "COMMA"

	// Skip orphan operators / topics that survived preprocessing — they're
	// usually the residue of a previous parseList that bailed early.
	skipOrphans(ts);

	const first = parseFactor(ts, parentSubject, warnings);
	if (first) items.push(first);

	while (true) {
		const t = ts.peek();
		if (!t) break;
		if (STOP_TAGS.has(t.tag)) break;
		if (!SEP_TAGS.has(t.tag)) break;

		// Consume a run of separators (e.g. ", and") — track whether the run
		// included an explicit AND or OR.
		let sawAnd = false;
		let sawOr = false;
		let sawComma = false;
		while (true) {
			const p = ts.peek();
			if (!p || !SEP_TAGS.has(p.tag)) break;
			if (p.tag === "AND" || p.tag === "AMP" || p.tag === "PLUS" || p.tag === "AND_OR") sawAnd = true;
			else if (p.tag === "OR" || p.tag === "SLASH") sawOr = true;
			else if (p.tag === "COMMA") sawComma = true;
			ts.eat();
		}
		const next = parseFactor(ts, parentSubject, warnings);
		if (!next) break;
		items.push(next);
		seps.push(sawAnd ? "AND" : sawOr ? "OR" : "COMMA");
	}

	if (items.length === 0) return null;
	if (items.length === 1) return items[0];

	// Resolve COMMA-only separators by taking the type of the first explicit
	// AND or OR in the list — that's the dominant connector.
	const dominant = seps.find((s) => s !== "COMMA") ?? "AND";
	const effective = seps.map((s) => (s === "COMMA" ? dominant : s));

	const hasAnd = effective.includes("AND");
	const hasOr = effective.includes("OR");
	if (!hasOr) return mergeAll(items);
	if (!hasAnd) return mergeAny(items);

	// Mixed: group consecutive AND-connected items, then OR the groups
	// (AND binds tighter than OR).
	const groups = [[items[0]]];
	for (let i = 0; i < effective.length; i++) {
		if (effective[i] === "OR") groups.push([items[i + 1]]);
		else groups[groups.length - 1].push(items[i + 1]);
	}
	return mergeAny(groups.map((g) => (g.length === 1 ? g[0] : mergeAll(g))));
}

function parseFactor(ts, parentSubject, warnings) {
	// Strip leading modifier tokens that belong to no factor; they fall
	// through and attach to the next course as a leading modifier.
	let leadingGrade = null;
	let leadingConcurrent = null;
	let leadingEquivalent = false;
	while (true) {
		const t = ts.peek();
		if (!t) break;
		if (t.tag === "MIN_GRADE") {
			ts.eat();
			leadingGrade = t.value;
			continue;
		}
		if (t.tag === "CONCURRENT_REQ") {
			ts.eat();
			leadingConcurrent = "required";
			continue;
		}
		if (t.tag === "CONCURRENT_OK") {
			ts.eat();
			leadingConcurrent = "allowed";
			continue;
		}
		if (t.tag === "EQUIVALENT") {
			ts.eat();
			leadingEquivalent = true;
			continue;
		}
		break;
	}

	const t = ts.peek();
	if (!t) return null;

	const applyLeading = (n) => {
		if (!n) return n;
		if (n.kind === "course") {
			if (leadingGrade) n.minGrade = leadingGrade;
			if (leadingConcurrent) n.concurrent = leadingConcurrent;
			if (leadingEquivalent) n.equivalentOk = true;
		}
		return n;
	};

	if (t.tag === "LPAREN" || t.tag === "LBRACKET") {
		ts.eat();
		const closeTag = t.tag === "LPAREN" ? "RPAREN" : "RBRACKET";
		const inner = parseOrSemi(ts, parentSubject, warnings);
		if (!ts.match(closeTag)) warnings.push(`unclosed-${closeTag}`);
		return applyLeading(inner);
	}

	if (t.tag === "COURSE") {
		ts.eat();
		const node = courseFromCode(t.code);
		if (t._leadingGrade) node.minGrade = t._leadingGrade;
		applyLeading(node);
		applyTrailingModifiers(ts, node);
		return node;
	}

	if (t.tag === "CONSENT") {
		ts.eat();
		return { kind: "consent", source: t.value ?? "instructor" };
	}

	if (t.tag === "STANDING") {
		ts.eat();
		const lvl = t.value.level;
		const orAbove = t.value.or != null;
		return { kind: "standing", level: lvl, ...(orAbove ? { orAbove: true } : {}) };
	}

	if (t.tag === "LEVEL_WILDCARD") {
		ts.eat();
		const lvl = t.value.level;
		const subjects = t.value.text ? [t.value.text] : parentSubject ? [parentSubject] : [];
		return { kind: "level-wildcard", levels: [lvl], subjects };
	}

	if (t.tag === "NONE") {
		ts.eat();
		return { kind: "none" };
	}

	if (t.tag === "RAW_VARY") {
		ts.eat();
		return { kind: "raw", text: t.value, reason: "vary-by-topic" };
	}

	if (t.tag === "TOPIC") {
		ts.eat();
		// Skip filler / connector phrases that leaked through tokenization
		if (isFillerTopic(t.text)) {
			return parseFactor(ts, parentSubject, warnings);
		}
		warnings.push(`topic:${t.text.slice(0, 40)}`);
		return applyLeading({ kind: "topic", topic: t.text });
	}

	// Don't consume tokens we don't recognize — let the caller decide.
	// (parseList skips orphan operators / topics between factors.)
	return null;
}

const MOD_TAGS = new Set(["MIN_GRADE", "EQUIVALENT", "CONCURRENT_REQ", "CONCURRENT_OK"]);

function applyModifierToken(t, courseNode) {
	if (t.tag === "MIN_GRADE") courseNode.minGrade = t.value;
	else if (t.tag === "EQUIVALENT") courseNode.equivalentOk = true;
	else if (t.tag === "CONCURRENT_REQ") courseNode.concurrent = "required";
	else if (t.tag === "CONCURRENT_OK") courseNode.concurrent = "allowed";
}

function applyTrailingModifiers(ts, courseNode) {
	while (true) {
		const t = ts.peek();
		if (!t) return;
		// Direct trailing modifier
		if (MOD_TAGS.has(t.tag)) {
			ts.eat();
			applyModifierToken(t, courseNode);
			continue;
		}
		// Parenthesized single modifier — "( EQUIVALENT )" / "(C- or better)"
		// is shaped as LPAREN MOD RPAREN.
		if (t.tag === "LPAREN") {
			const inner = ts.peek(1);
			const close = ts.peek(2);
			if (inner && close && MOD_TAGS.has(inner.tag) && close.tag === "RPAREN") {
				ts.eat();
				ts.eat();
				ts.eat();
				applyModifierToken(inner, courseNode);
				continue;
			}
		}
		return;
	}
}

// === Helpers ============================================================

function courseFromCode(code) {
	// "COMP_SCI 110-0", "BUSCOM 601S", "ECON 202-0", "MATH 290-3"
	const m = code.match(/^([A-Z][A-Z0-9_]*)\s+(\d+[A-Z]?)(?:-([A-Z0-9]+))?\s*$/);
	if (!m) return { kind: "course", subject: code, number: "", section: "" };
	// When the catalog wraps the code without a section dash (e.g. law /
	// graduate courses), keep section empty rather than synthesizing "-0".
	return { kind: "course", subject: m[1], number: m[2], section: m[3] ?? "" };
}

function mergeAll(nodes) {
	const flat = [];
	for (const n of nodes) {
		if (!n) continue;
		if (n.kind === "all") flat.push(...n.of);
		else flat.push(n);
	}
	if (flat.length === 0) return null;
	if (flat.length === 1) return flat[0];
	return { kind: "all", of: flat };
}

function mergeAny(nodes) {
	const flat = [];
	for (const n of nodes) {
		if (!n) continue;
		if (n.kind === "any") flat.push(...n.of);
		else flat.push(n);
	}
	if (flat.length === 0) return null;
	if (flat.length === 1) return flat[0];
	return { kind: "any", of: flat };
}

// === Public entry ========================================================

export function parseCatalogPrereq(segments, parentSubject) {
	const warnings = [];
	if (!segments || segments.length === 0) {
		return { parsed: null, warnings };
	}
	const afterTrail = applyTrailStrip(segments);
	const leadingGrade = {};
	const afterWrap = applyWrapperStrip(afterTrail, leadingGrade);
	const afterPeriod = applyPeriodSplit(afterWrap);
	const afterMid = applyMidStrip(afterPeriod);
	const tokens = tokenizeSegments(afterMid);
	if (leadingGrade.grade) {
		// attach to first COURSE token
		for (const t of tokens) {
			if (t.tag === "COURSE") {
				t._leadingGrade = leadingGrade.grade;
				break;
			}
		}
	}
	if (tokens.length === 0) return { parsed: null, warnings };

	// Quick short-circuit: bare NONE or RAW_VARY at top level.
	if (tokens.length === 1) {
		if (tokens[0].tag === "NONE") return { parsed: { kind: "none" }, warnings };
		if (tokens[0].tag === "RAW_VARY")
			return { parsed: { kind: "raw", text: tokens[0].value, reason: "vary-by-topic" }, warnings };
	}

	const parsed = parseTokens(tokens, parentSubject, warnings);
	return { parsed, warnings };
}
