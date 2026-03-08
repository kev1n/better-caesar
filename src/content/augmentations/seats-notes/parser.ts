import type { LookupClassResponse } from "../../../shared/messages";
import type { SeatsNotesFailure, SeatsNotesResult, SeatsNotesSuccess } from "./types";

export function toSeatsNotesResult(response: LookupClassResponse): SeatsNotesResult {
  if (!response.ok) return { ok: false, error: response.error };

  const detailText = response.detailResponseText;
  if (!detailText || response.detailPageId !== "SSR_CLSRCH_DTL") {
    return {
      ok: true,
      requestedClassNumber: response.requestedClassNumber,
      criteriaClassNumber: response.criteriaClassNumber,
      classCapacity: null,
      enrollmentTotal: null,
      availableSeats: null,
      waitListCapacity: null,
      waitListTotal: null,
      classAttributes: null,
      enrollmentRequirements: null,
      classNotes: null
    };
  }

  const success: SeatsNotesSuccess = {
    ok: true,
    requestedClassNumber: response.requestedClassNumber,
    criteriaClassNumber: response.criteriaClassNumber,
    classCapacity: extractTextById(detailText, "SSR_CLS_DTL_WRK_ENRL_CAP"),
    enrollmentTotal: extractTextById(detailText, "SSR_CLS_DTL_WRK_ENRL_TOT"),
    availableSeats: extractTextById(detailText, "SSR_CLS_DTL_WRK_AVAILABLE_SEATS"),
    waitListCapacity: extractTextById(detailText, "SSR_CLS_DTL_WRK_WAIT_CAP"),
    waitListTotal: extractTextById(detailText, "SSR_CLS_DTL_WRK_WAIT_TOT"),
    classAttributes: extractLongTextById(detailText, "SSR_CLS_DTL_WRK_SSR_CRSE_ATTR_LONG"),
    enrollmentRequirements: extractEnrollmentRequirements(detailText),
    classNotes: extractLongTextById(detailText, "DERIVED_CLSRCH_SSR_CLASSNOTE_LONG")
  };

  return success;
}

export function toFailure(error: unknown): SeatsNotesFailure {
  const text = error instanceof Error ? error.message : "Unknown error.";
  return { ok: false, error: text };
}

function extractEnrollmentRequirements(responseText: string): string | null {
  // Try the plain-text span version first (appears in SSR_CLSRCH_DTL Enrollment Information group).
  const span = extractLongTextById(responseText, "SSR_CLS_DTL_WRK_SSR_REQUISITE_LONG");
  if (span) return span;

  // Fall back to the HTML area version (DERIVED_CLS_DTL_SSR_REQUISITE_LONG, dynamic ID suffix).
  return extractHtmlAreaNearId(responseText, "DERIVED_CLS_DTL_SSR_REQUISITE_LONG");
}

function extractHtmlAreaNearId(responseText: string, partialId: string): string | null {
  // Find the first element whose id begins with this partial id (handles $246$ style suffixes).
  const escapedId = partialId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const idPattern = new RegExp(`id=['"](?:win0div)?${escapedId}[^'"]*['"]`, "i");
  const idMatch = idPattern.exec(responseText);
  if (!idMatch) return null;

  // Look for the HTML area comment block that follows.
  const afterId = responseText.slice(idMatch.index);
  const areaPattern = /<!--\s*Begin HTML Area[^>-]*-->([\s\S]*?)<!--\s*End HTML Area\s*-->/i;
  const areaMatch = areaPattern.exec(afterId);
  if (!areaMatch) return null;

  const raw = areaMatch[1] ?? "";
  const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  const items: string[] = [];
  let liMatch: RegExpExecArray | null;
  while ((liMatch = liPattern.exec(raw)) !== null) {
    const text = (liMatch[1] ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) items.push(decodeEntities(text));
  }

  return items.length > 0 ? items.join(" | ") : null;
}

function extractTextById(responseText: string, id: string): string | null {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`id=['"]${escapedId}['"][\\s\\S]*?>\\s*([^<]+?)\\s*<`, "i");
  const value = pattern.exec(responseText)?.[1];
  return normalizeText(value);
}

function extractLongTextById(responseText: string, id: string): string | null {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`id=['"]${escapedId}['"][^>]*>([\\s\\S]*?)<\\/span>`, "i");
  const raw = pattern.exec(responseText)?.[1];
  if (!raw) return null;

  const normalized = raw
    .replace(/<br\s*\/?>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return decodeEntities(normalized);
}

function normalizeText(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = decodeEntities(value);
  return normalized.length > 0 ? normalized : null;
}

function decodeEntities(value: string): string {
  const element = document.createElement("textarea");
  element.innerHTML = value;
  return element.value.replace(/\s+/g, " ").trim();
}
