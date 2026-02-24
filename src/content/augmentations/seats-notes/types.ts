export type RowTarget = {
  classNumber: string;
  careerHint: "UGRD" | "TGS" | undefined;
  cells: RowCells;
};

export type RowCells = {
  seatsCell: HTMLTableCellElement;
  notesCell: HTMLTableCellElement;
};

export type SeatsNotesSuccess = {
  ok: true;
  requestedClassNumber: string;
  criteriaClassNumber: string | null;
  classCapacity: string | null;
  enrollmentTotal: string | null;
  availableSeats: string | null;
  waitListCapacity: string | null;
  waitListTotal: string | null;
  enrollmentInfoNotes: string | null;
  classNotes: string | null;
};

export type SeatsNotesFailure = {
  ok: false;
  error: string;
};

export type SeatsNotesResult = SeatsNotesSuccess | SeatsNotesFailure;
