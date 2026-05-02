import { isFeatureEnabled } from "../../settings";
import { PAPER_CTEC_CONFIG } from "./config";

export const RATING_PERCENT_FEATURE_ID = "paper-ctec-rating-percent";

export function isRatingPercentMode(): boolean {
  return isFeatureEnabled(RATING_PERCENT_FEATURE_ID);
}

export function formatRatingPercent(mean: number): string {
  const max = PAPER_CTEC_CONFIG.aggregate.ratingScaleMax;
  const clamped = Math.max(0, Math.min(max, mean));
  return `${Math.round((clamped / max) * 100)}%`;
}

export function formatChipRating(mean: number): string {
  return isRatingPercentMode() ? formatRatingPercent(mean) : mean.toFixed(1);
}

export function formatRatingDetail(mean: number): string {
  return isRatingPercentMode() ? formatRatingPercent(mean) : mean.toFixed(2);
}

export function ratingPercentSignature(): string {
  return isRatingPercentMode() ? "pct" : "raw";
}
