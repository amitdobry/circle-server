/**
 * Content Phase Configuration Types
 */

export interface ContentQuestion {
  id: string;
  text: string;
  intensity: "soft" | "medium" | "deep";
}

export interface ContentSubject {
  key: string;
  label: string;
  description: string;
  questions: ContentQuestion[];
}

export interface ContentThemeConfig {
  tableThemeKey: string;
  tableThemeLabel: string;
  phaseKey: string;
  phaseTitle: string;
  phaseSubtitle: string;
  minUsersToStart: number;
  selectionMode: "vote-subject-random-question";
  tieBreakMode: "random-between-tied-subjects";
  subjects: ContentSubject[];
}
