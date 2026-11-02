import { customAlphabet } from "nanoid";

const letters = customAlphabet("abcdefghijklmnopqrstuvwxyz", 10);

/** Google-Meet style meeting code, e.g. "abc-defg-hij". */
export function generateMeetingCode(): string {
  const raw = letters();
  return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
}