export type LookupClassMessage = {
  type: "lookup-class";
  classNumber: string;
  careerHint?: "UGRD" | "TGS";
};

export type LookupClassSuccess = {
  ok: true;
  requestedClassNumber: string;
  criteriaClassNumber: string | null;
  firstResultClassNumber: string | null;
  firstResultCourseTitle: string | null;
  firstResultSection: string | null;
  firstResultInstructor: string | null;
  firstResultDaysTimes: string | null;
  firstResultRoom: string | null;
  firstResultMeetingDates: string | null;
  firstResultGrading: string | null;
  firstResultStatus: string | null;
  nextActionForDetails: string | null;
  searchPageId: string | null;
  detailPageId: string | null;
  detailResponseText: string | null;
};

export type LookupClassFailure = {
  ok: false;
  error: string;
};

export type LookupClassResponse = LookupClassSuccess | LookupClassFailure;
