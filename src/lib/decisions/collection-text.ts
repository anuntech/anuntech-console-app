/*
 * Pure helpers for the collection draft: the payment links leave the text
 * before it goes to the model and come back after, so a link is never
 * rewritten, shortened or invented.
 */

const MARKER = "[[LINKS]]";
const URL = /https?:\/\/\S+/;

/** Lines with a payment link become one marker, where the first of them was. */
export function protectLinks(message: string): { text: string; links: string[] } {
  const lines = message.split("\n");
  const links = lines.filter((line) => URL.test(line));
  if (!links.length) return { text: message, links };
  const first = lines.findIndex((line) => URL.test(line));
  const kept = lines.flatMap((line, i) => (URL.test(line) ? (i === first ? [MARKER] : []) : [line]));
  return { text: kept.join("\n"), links };
}

/**
 * The links back in the marker's place. An answer that lost the marker, or
 * brought a link of its own, is refused (null): the base text stays.
 */
export function restoreLinks(answer: string, links: string[]): string | null {
  if (!answer.trim()) return null;
  if (URL.test(answer.replaceAll(MARKER, ""))) return null;
  if (!links.length) return answer.includes(MARKER) ? null : answer;
  if (answer.split(MARKER).length !== 2) return null;
  return answer.replace(MARKER, links.join("\n"));
}
