import { FEATURES_STORAGE_KEY } from "../content/settings";

const CTEC_INDEX_KEY = "better-caesar:ctec-index:v1";

const FEATURES: { id: string; label: string }[] = [
  { id: "seats-notes", label: "Seats & Notes" },
  { id: "ctec-links", label: "CTEC Links" },
  { id: "paper-ctec", label: "paper.nu CTEC" },
  { id: "ctec-navigation", label: "CTEC Navigator" },
  { id: "enrollment-navigation", label: "Enrollment Terms" }
];

async function loadSettings(): Promise<Record<string, boolean>> {
  const result = await chrome.storage.local.get(FEATURES_STORAGE_KEY) as Record<string, unknown>;
  const raw = result[FEATURES_STORAGE_KEY];
  if (raw && typeof raw === "object") return raw as Record<string, boolean>;
  return {};
}

async function saveSettings(settings: Record<string, boolean>): Promise<void> {
  await chrome.storage.local.set({ [FEATURES_STORAGE_KEY]: settings });
}

async function init(): Promise<void> {
  const settings = await loadSettings();
  const list = document.getElementById("feature-list");
  if (!list) return;

  for (const feature of FEATURES) {
    const enabled = settings[feature.id] !== false;

    const li = document.createElement("li");
    li.className = "feature-row";

    const label = document.createElement("span");
    label.className = "feature-label";
    label.textContent = feature.label;

    const toggle = document.createElement("button");
    toggle.className = `toggle ${enabled ? "on" : "off"}`;
    toggle.setAttribute("aria-pressed", String(enabled));
    toggle.setAttribute("aria-label", `Toggle ${feature.label}`);

    toggle.addEventListener("click", async () => {
      const next = toggle.getAttribute("aria-pressed") !== "true";
      toggle.setAttribute("aria-pressed", String(next));
      toggle.className = `toggle ${next ? "on" : "off"}`;
      const current = await loadSettings();
      current[feature.id] = next;
      await saveSettings(current);
    });

    li.appendChild(label);
    li.appendChild(toggle);
    list.appendChild(li);
  }
}

function initClearCacheButton(): void {
  const btn = document.getElementById("clear-ctec-cache");
  if (!(btn instanceof HTMLButtonElement)) return;
  btn.addEventListener("click", async () => {
    await chrome.storage.local.remove(CTEC_INDEX_KEY);
    btn.textContent = "Cleared!";
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = "Clear CTEC cache";
      btn.disabled = false;
    }, 1500);
  });
}

void init();
initClearCacheButton();
