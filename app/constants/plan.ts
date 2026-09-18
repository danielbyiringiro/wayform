// Wayform — resolves a pair's chosen Study Plan into a single day's content.
// The three plan types (see app.txt) share one shape (PlanDay) so the loop
// page doesn't need to branch on plan type.

import { absgSections, getAbsgSection, ABSG_LESSON_TITLE } from "./absg";
import { chaptersInBook } from "./bible";

export type PlanType = "absg" | "chapter_a_day" | "custom_range";

export interface ChapterADayConfig {
  book: string;
}

export interface CustomRangeConfig {
  book: string;
  startChapter: number;
  endChapter: number;
}

export type PlanConfig = Partial<ChapterADayConfig & CustomRangeConfig>;

export interface PlanDay {
  dayIndex: number;
  title: string;
  reference: string;
  /** Embedded fallback text, if any (only ABSG ships one). */
  fallbackText: string | null;
  translation: string;
  audioUrl: string | null;
  identityReframe: string | null;
  identityReframeRequired: boolean;
  microPractice: string;
}

const GENERIC_MICRO_PRACTICES = [
  "Share one verse from today's reading with your partner and say why it stood out.",
  "Pray together for two minutes about what you just read.",
  "Send your partner one question this passage raised for you.",
  "Read today's passage aloud to each other, even if you're apart.",
  "Name one thing you'll do differently today because of this passage — tell your partner.",
];

function genericMicroPractice(dayIndex: number): string {
  return GENERIC_MICRO_PRACTICES[(dayIndex - 1) % GENERIC_MICRO_PRACTICES.length];
}

/** Total days in the plan, or 0 if the plan/config isn't resolvable yet. */
export function planTotalDays(planType: PlanType, config: PlanConfig): number {
  switch (planType) {
    case "absg":
      return absgSections.length;
    case "chapter_a_day":
      return config.book ? chaptersInBook(config.book) : 0;
    case "custom_range": {
      if (!config.book || !config.startChapter || !config.endChapter) return 0;
      return Math.max(1, config.endChapter - config.startChapter + 1);
    }
    default:
      return 0;
  }
}

export function planLabel(planType: PlanType): string {
  switch (planType) {
    case "absg":
      return "ABSG — Sabbath School Adult Bible Study Guide";
    case "chapter_a_day":
      return "Bible Chapter a Day";
    case "custom_range":
      return "Custom Passage Range";
  }
}

export function getPlanDay(
  planType: PlanType,
  config: PlanConfig,
  dayIndex: number,
): PlanDay | null {
  const total = planTotalDays(planType, config);
  if (total === 0 || dayIndex < 1 || dayIndex > total) return null;

  if (planType === "absg") {
    const section = getAbsgSection(dayIndex);
    if (!section) return null;
    return {
      dayIndex,
      title: `${ABSG_LESSON_TITLE} · ${section.label}`,
      reference: section.reference,
      fallbackText: section.text,
      translation: section.translation,
      audioUrl: section.audioUrl,
      identityReframe: section.identityReframe,
      identityReframeRequired: true,
      microPractice: section.microPractice,
    };
  }

  const book = config.book!;
  const chapter =
    planType === "chapter_a_day" ? dayIndex : config.startChapter! + dayIndex - 1;

  return {
    dayIndex,
    title: `${book} ${chapter}`,
    reference: `${book} ${chapter}`,
    fallbackText: null,
    translation: "ESV, fetched live",
    audioUrl: null,
    identityReframe: null,
    identityReframeRequired: false,
    microPractice: genericMicroPractice(dayIndex),
  };
}
