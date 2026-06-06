import type { MemoSectionSignal } from "@shared/types";

export const SIGNAL_BADGE_TONE: Record<
  MemoSectionSignal,
  "up" | "down" | "flat" | "warning"
> = {
  positive: "up",
  negative: "down",
  neutral: "flat",
  watch: "warning",
};

export const SIGNAL_LABEL: Record<MemoSectionSignal, string> = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
  watch: "Watch",
};
