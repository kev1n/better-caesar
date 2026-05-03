import {
  addSectionToCart,
  matchCaesarGroup,
  matchCaesarSection,
  searchCaesarCatalog,
  type CartFlowResult
} from "../class-search/caesar-search";
import { bareCatalogNumber } from "../class-search/catalog-format";
import {
  getDataMapInfo,
  getTermCourses,
  type PaperSection,
  type PaperTermCourse
} from "../class-search/paper-data";
import type { CtecLinkParams } from "../ctec-links/types";
import { buildInstructorLastNameLabel } from "./identity";
import { getActivePaperTermId } from "./paper-active-term";

export type CartChipResult =
  | {
      ok: true;
      classNumber: string;
      sectionLabel: string;
      termId: string;
    }
  | {
      ok: false;
      error: string;
      alreadyInCart?: boolean;
      classNumber?: string;
    };

const INSTITUTION_DEFAULT = "NWUNV";

// End-to-end cart-add flow driven from a paper.nu schedule chip. The chip
// only knows subject + catalog + instructor + topic, so we:
//   1. Assume the user is planning the latest paper.nu term (info.latest).
//   2. Find the matching section in that term's cached course data using
//      subject/catalog and the chip's last-name instructor label.
//   3. Run a CAESAR catalog search to resolve the 5-digit class number.
//   4. Drive CAESAR's Search → Select → Next chain via background fetches.
//
// This avoids any new permissions and reuses paper-data's existing cache
// so we never touch paper.nu's IndexedDB.
export async function addChipSectionToCart(
  params: CtecLinkParams,
  titleHint: string,
  onProgress?: (message: string) => void
): Promise<CartChipResult> {
  try {
    onProgress?.("Loading paper.nu term data…");
    const info = await getDataMapInfo();
    const { termId } = await getActivePaperTermId();
    if (!termId) {
      return { ok: false, error: "Couldn't determine the active paper.nu term." };
    }

    const courses = await getTermCourses(termId);
    const match = findSection(courses, params, titleHint);
    if (!match) {
      return {
        ok: false,
        error: `No section of ${params.subject} ${params.catalogNumber} taught by ${params.instructor || "this instructor"} found in ${info.terms[termId]?.name ?? termId}.`
      };
    }

    const career = inferCareer(params.catalogNumber);

    onProgress?.(`Searching CAESAR for ${params.subject} ${params.catalogNumber}…`);
    const search = await searchCaesarCatalog({
      termId,
      career,
      institution: INSTITUTION_DEFAULT,
      subject: params.subject,
      bareCatalog: bareCatalogNumber(params.catalogNumber)
    });

    // CTEC links carry only the bare number ("105"); paper.nu's resolved
    // section knows the full catalog including the suffix ("105-8"). Use
    // the resolved value so `matchCaesarGroup` lands on the right group.
    const group = matchCaesarGroup(search.groups, match.catalog ?? params.catalogNumber);
    const caesarSection = group
      ? matchCaesarSection(group, match.section, match.component)
      : null;
    if (!caesarSection) {
      return {
        ok: false,
        error: `CAESAR didn't return section ${match.section}-${match.component} for ${params.subject} ${params.catalogNumber} in ${info.terms[termId]?.name ?? termId}.`
      };
    }

    onProgress?.(`Adding #${caesarSection.classNumber}…`);
    const result: CartFlowResult = await addSectionToCart({
      classNumber: caesarSection.classNumber,
      termId,
      career,
      institution: INSTITUTION_DEFAULT
    });

    if (result.ok) {
      return {
        ok: true,
        classNumber: result.classNumber,
        sectionLabel: result.sectionLabel,
        termId
      };
    }
    if ("needsRelatedSection" in result) {
      // paper-ctec's cart flow can't show an inline picker — bail with a
      // pointer to the class-search UI which has the picker wired up.
      return {
        ok: false,
        error: `${params.subject} ${params.catalogNumber} requires picking a discussion/lab. Add it from Class Search.`,
        classNumber: result.classNumber
      };
    }
    return {
      ok: false,
      error: result.error,
      alreadyInCart: result.alreadyInCart,
      classNumber: result.classNumber ?? caesarSection.classNumber
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Picks the section a chip represents from paper.nu's course data. We have
// to disambiguate because a course can have many sections; we use the same
// last-name instructor label the rest of the augmentation uses (so "Smith,
// Jones" matches "Jones, Smith" too) and topic if the chip carries one.
// Falls back to LEC over discussion/lab when multiple sections still tie.
function findSection(
  courses: PaperTermCourse[],
  params: CtecLinkParams,
  titleHint: string
): PaperSection | null {
  const targetCatalog = params.catalogNumber.toLowerCase();
  const matchingCourses = courses.filter(
    (c) =>
      c.subject === params.subject &&
      sameCatalog(c.catalog.toLowerCase(), targetCatalog)
  );
  if (matchingCourses.length === 0) return null;

  const wantInstructor = sortedLower(params.instructor);
  const wantTopic = extractTopic(titleHint);

  const candidates: PaperSection[] = [];
  for (const course of matchingCourses) {
    for (const section of course.sections) {
      const label = buildInstructorLastNameLabel(
        (section.instructors ?? [])
          .map((i) => i.name?.trim() ?? "")
          .filter(Boolean)
      );
      if (sortedLower(label) !== wantInstructor) continue;
      if (wantTopic && section.topic && section.topic.trim() !== wantTopic) continue;
      candidates.push(section);
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;

  const lec = candidates.find((s) => s.component === "LEC");
  return lec ?? candidates[0]!;
}

function sortedLower(value: string): string {
  return value
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join(",");
}

function sameCatalog(a: string, b: string): boolean {
  if (a === b) return true;
  // Tolerate paper.nu's "111" vs CAESAR-style "111-0".
  if (a.replace(/-0$/, "") === b.replace(/-0$/, "")) return true;
  // CTEC links strip catalog suffixes ("CHEM 105" instead of "CHEM 105-8")
  // because the regex in ctec-links/helpers.ts only captures three digits.
  // Treat bare-vs-suffixed as a match when the bare numbers agree;
  // findSection's instructor + topic filters disambiguate from there.
  const bareA = a.split("-")[0] ?? "";
  const bareB = b.split("-")[0] ?? "";
  if (bareA && bareA === bareB && (a === bareA || b === bareB)) return true;
  return false;
}

// titleHint is "{topic} - {subtitle}" when a topic exists, otherwise the
// subtitle alone. Pull the topic back out so we can disambiguate sections.
function extractTopic(titleHint: string): string | null {
  if (!titleHint) return null;
  const idx = titleHint.indexOf(" - ");
  if (idx <= 0) return null;
  return titleHint.slice(0, idx).trim();
}

// Best-effort career hint for the cart-add chain. CAESAR rejects the search
// if the career doesn't match the section, so a wrong guess fails fast — and
// 4xx/5xx CTECs at NU are catalogued under TGS per the shared CTEC index.
function inferCareer(catalogNumber: string): string {
  const first = catalogNumber.replace(/[^0-9]/g, "").charAt(0);
  if (first === "4" || first === "5") return "TGS";
  return "UGRD";
}
