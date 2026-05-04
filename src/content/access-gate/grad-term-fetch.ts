import { fetchTextResultViaBackground } from "../remote-fetch";

const GRAD_TERM_URL =
  "https://caesar.ent.northwestern.edu/psc/csnu/EMPLOYEE/SA/c/SAA_STUDENT_FL.SAA_EXP_GRD_TRM_FL.GBL?Action=U";

// The page renders one row per academic program. We pick the earliest year
// across all rows so dual-program students fall into the most senior bucket.
const GRAD_TERM_PATTERN = /id=['"]GRAD_TERM2\$\d+['"][^>]*>(\d{4})/g;

export async function fetchGradYear(): Promise<number | null> {
  try {
    const response = await fetchTextResultViaBackground(GRAD_TERM_URL);
    if (response.status < 200 || response.status >= 300) return null;
    return parseGradYearFromHtml(response.text);
  } catch {
    return null;
  }
}

function parseGradYearFromHtml(html: string): number | null {
  const years: number[] = [];
  for (const match of html.matchAll(GRAD_TERM_PATTERN)) {
    const year = Number.parseInt(match[1], 10);
    if (Number.isFinite(year)) years.push(year);
  }
  if (years.length === 0) return null;
  return Math.min(...years);
}
