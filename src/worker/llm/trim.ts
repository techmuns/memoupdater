import type {
  GenerateFollowUpMemoRequest,
  GenerateFollowUpMemoUpdateDoc,
} from "@shared/types";

const INITIAL_MEMO_CHAR_CAP = 40_000;
const UPDATE_DOC_CHAR_CAP = 30_000;
const ELISION = "\n\n[... truncated for length ...]\n\n";

// Financial documents back-load conclusions and front-load summaries, so
// head + tail elision preserves more useful context than a single head trim.
export function trimToCharBudget(text: string, charBudget: number): string {
  if (text.length <= charBudget) return text;
  const usable = Math.max(charBudget - ELISION.length, 0);
  const headLen = Math.floor(usable * 0.7);
  const tailLen = usable - headLen;
  return text.slice(0, headLen) + ELISION + text.slice(text.length - tailLen);
}

export function trimRequestBody(
  req: GenerateFollowUpMemoRequest,
): GenerateFollowUpMemoRequest {
  return {
    ...req,
    initialMemo: {
      ...req.initialMemo,
      text: trimToCharBudget(req.initialMemo.text, INITIAL_MEMO_CHAR_CAP),
    },
    updateDocs: req.updateDocs.map(
      (doc): GenerateFollowUpMemoUpdateDoc => ({
        ...doc,
        text: trimToCharBudget(doc.text, UPDATE_DOC_CHAR_CAP),
      }),
    ),
  };
}
