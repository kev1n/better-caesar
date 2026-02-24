import type { LookupClassMessage, LookupClassResponse } from "../shared/messages";

const ui = getUi();

ui.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const classNumber = ui.classNumberInput.value.trim();

  if (!classNumber) {
    ui.resultEl.textContent = "Enter a class number.";
    return;
  }

  setBusy(true);
  ui.resultEl.textContent = "Loading...";

  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("No active tab found.");
    if (
      !tab.url?.includes("caesar.ent.northwestern.edu") &&
      !tab.url?.includes("caesar.northwestern.edu")
    ) {
      throw new Error("Open CAESAR in the active tab first.");
    }

    const message: LookupClassMessage = { type: "lookup-class", classNumber };
    const response = (await chrome.tabs.sendMessage(tab.id, message)) as LookupClassResponse;

    if (!response) {
      throw new Error("No response from content script. Reload the CAESAR tab and retry.");
    }

    ui.resultEl.textContent = formatResponse(response);
  } catch (error) {
    const text = error instanceof Error ? error.message : "Unknown error.";
    ui.resultEl.textContent = `Error: ${text}`;
  } finally {
    setBusy(false);
  }
});

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function setBusy(isBusy: boolean): void {
  ui.submitButton.disabled = isBusy;
  ui.classNumberInput.disabled = isBusy;
}

function formatResponse(response: LookupClassResponse): string {
  if (!response.ok) return `Error: ${response.error}`;

  return JSON.stringify(
    {
      requestedClassNumber: response.requestedClassNumber,
      criteriaClassNumber: response.criteriaClassNumber,
      firstResultClassNumber: response.firstResultClassNumber,
      firstResultCourseTitle: response.firstResultCourseTitle,
      firstResultSection: response.firstResultSection,
      firstResultInstructor: response.firstResultInstructor,
      firstResultDaysTimes: response.firstResultDaysTimes,
      firstResultRoom: response.firstResultRoom,
      firstResultMeetingDates: response.firstResultMeetingDates,
      firstResultGrading: response.firstResultGrading,
      firstResultStatus: response.firstResultStatus,
      classCapacity: response.classCapacity,
      enrollmentTotal: response.enrollmentTotal,
      availableSeats: response.availableSeats,
      waitListCapacity: response.waitListCapacity,
      waitListTotal: response.waitListTotal,
      enrollmentInfoNotes: response.enrollmentInfoNotes,
      classNotes: response.classNotes,
      nextActionForDetails: response.nextActionForDetails
    },
    null,
    2
  );
}

function getUi(): {
  form: HTMLFormElement;
  classNumberInput: HTMLInputElement;
  resultEl: HTMLElement;
  submitButton: HTMLButtonElement;
} {
  const form = document.querySelector<HTMLFormElement>("#lookup-form");
  const classNumberInput = document.querySelector<HTMLInputElement>("#class-number");
  const resultEl = document.querySelector<HTMLElement>("#result");
  const submitButton = form?.querySelector<HTMLButtonElement>("button[type='submit']");

  if (!form || !classNumberInput || !resultEl || !submitButton) {
    throw new Error("Popup UI failed to initialize.");
  }

  return { form, classNumberInput, resultEl, submitButton };
}
