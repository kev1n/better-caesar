import type { CalendarApp } from "./types";

export type AppLink = {
  label: string;
  href: string;
};

export type AppContent = {
  intro: string;
  steps: ReadonlyArray<string>;
  deepLink: AppLink | null;
  // Apple Calendar has no web import flow, so it gets a help link
  // instead of the primary deep-link CTA.
  helpLink: AppLink | null;
};

// Step copy is intentionally short — long instructions in a modal are
// skipped. Each step starts with an imperative verb. Step 1 always
// points back at our own Download button so the flow reads top-to-bottom.
export const APP_CONTENT: Record<CalendarApp, AppContent> = {
  google: {
    intro: "Import the .ics file into your Google Calendar from any computer browser.",
    steps: [
      "Click Download .ics below to save the schedule file.",
      "Open Google Calendar's Import & Export page (link below).",
      "Under Import, click Select file from your computer and pick the file you just downloaded.",
      "Choose which calendar to add the events to, then click Import."
    ],
    deepLink: {
      label: "Open Google Calendar Import",
      href: "https://calendar.google.com/calendar/u/0/r/settings/export"
    },
    helpLink: {
      label: "Google's full instructions",
      href: "https://support.google.com/calendar/answer/37118"
    }
  },
  apple: {
    intro: "Apple Calendar doesn't have a web import flow, so the steps differ by device.",
    steps: [
      "Click Download .ics below to save the schedule file.",
      "On a Mac: open Calendar, then File → Import… and pick the .ics file.",
      "On iPhone or iPad: open the file from Files or your Downloads — iOS will prompt you to add events to a calendar.",
      "Pick the calendar you want the events to land in and confirm."
    ],
    deepLink: null,
    helpLink: {
      label: "Apple's full instructions",
      href: "https://support.apple.com/guide/calendar/import-or-export-calendars-icl1023/mac"
    }
  },
  outlook: {
    intro: "Import the .ics file into Outlook on the web — works for personal and Northwestern accounts.",
    steps: [
      "Click Download .ics below to save the schedule file.",
      "Open Outlook on the web (link below) and switch to the Calendar view.",
      "Click Add calendar in the left sidebar, then choose Upload from file.",
      "Select the .ics file, pick which calendar to add events to, and click Import."
    ],
    deepLink: {
      label: "Open Outlook Calendar",
      href: "https://outlook.office.com/calendar/"
    },
    helpLink: {
      label: "Microsoft's full instructions",
      href: "https://support.microsoft.com/en-us/office/import-calendars-into-outlook-8e8364e1-400e-4c0f-a573-fe76b5a2d379"
    }
  }
};

export const CENTRAL_TIME_WARNING =
  "Make sure your calendar's time zone is set to Central Time (Chicago) before importing — otherwise classes will land at the wrong hour.";
