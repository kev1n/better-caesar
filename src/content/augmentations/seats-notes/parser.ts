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
      enrollmentInfoNotes: null,
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
    enrollmentInfoNotes: extractLongTextById(detailText, "SSR_CLS_DTL_WRK_SSR_CRSE_ATTR_LONG"),
    classNotes: extractLongTextById(detailText, "DERIVED_CLSRCH_SSR_CLASSNOTE_LONG")
  };

  return success;
}

export function toFailure(error: unknown): SeatsNotesFailure {
  const text = error instanceof Error ? error.message : "Unknown error.";
  return { ok: false, error: text };
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
