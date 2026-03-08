export const FEATURES_STORAGE_KEY = "better-caesar:features:v1";

// In-memory settings loaded from extension storage on startup.
// Defaults to enabled (true) for any unset feature.
let settings: Record<string, boolean> = {};

void chrome.storage.local
  .get(FEATURES_STORAGE_KEY)
  .then((result: Record<string, unknown>) => {
    const raw = result[FEATURES_STORAGE_KEY];
    if (raw && typeof raw === "object") {
      settings = raw as Record<string, boolean>;
    }
  });

export function isFeatureEnabled(id: string): boolean {
  return settings[id] !== false;
}
