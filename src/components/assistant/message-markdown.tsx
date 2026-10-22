"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { linkTarget } from "@/lib/assistant/link-rules";

/**
 * The little Markdown the assistant writes: paragraphs, bullet and numbered
 * lists, **bold**, `code` and [links](/relative). Console paths become
 * in-app navigation; web addresses open in a new tab with their domain shown
 * (lib/assistant/link-rules.ts). No raw HTML, ever.
 */
export function MessageMarkdown({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-2.5 text-sm leading-6 text-foreground [&_a]:font-medium [&_a]:text-link [&_a]:underline-offset-2 hover:[&_a]:underline">
      {blocks.map((block, index) => renderBlock(block.trim(), index, onNavigate))}
    </div>
  );
}

function renderBlock(block: string, key: number, onNavigate?: () => void) {
  if (!block) return null;
  const lines = block.split("\n");
  if (lines.every((line) => /^\s*[-*•]\s+/.test(line)))
    return (
      <ul key={key} className="m-0 flex list-disc flex-col gap-1 pl-5">
        {lines.map((line, i) => (
          <li key={i}>{inline(line.replace(/^\s*[-*•]\s+/, ""), onNavigate)}</li>
        ))}
      </ul>
    );
  if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line)))
    return (
      <ol key={key} className="m-0 flex list-decimal flex-col gap-1 pl-5">
        {lines.map((line, i) => (
          <li key={i}>{inline(line.replace(/^\s*\d+[.)]\s+/, ""), onNavigate)}</li>
        ))}
      </ol>
    );
  if (/^#{1,3}\s+/.test(lines[0]))
    return (
      <p key={key} className="m-0 font-medium">
        {inline(lines[0].replace(/^#{1,3}\s+/, ""), onNavigate)}
        {lines.length > 1 && <span className="block font-normal">{joinLines(lines.slice(1), onNavigate)}</span>}
      </p>
    );
  return (
    <p key={key} className="m-0">
      {joinLines(lines, onNavigate)}
    </p>
  );
}

function joinLines(lines: string[], onNavigate?: () => void) {
  return lines.flatMap((line, i) => (i === 0 ? [inline(line, onNavigate)] : [<br key={`br${i}`} />, inline(line, onNavigate)]));
}

const TOKEN = /(\[[^\]]+\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(`[^`]+`)|(https?:\/\/[^\s<>)]+)/g;

function inline(text: string, onNavigate?: () => void): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (match[1]) {
      const [, label, href] = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      parts.push(link(href, label, `l${match.index}`, onNavigate));
    } else if (match[2]) parts.push(<strong key={`b${match.index}`}>{token.slice(2, -2)}</strong>);
    else if (match[3])
      parts.push(
        <code key={`c${match.index}`} className="rounded bg-secondary px-1 py-0.5 text-[13px]">
          {token.slice(1, -1)}
        </code>,
      );
    else parts.push(link(token, token, `u${match.index}`, onNavigate));
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function link(href: string, label: string, key: string, onNavigate?: () => void) {
  const target = linkTarget(href);
  if (target.kind === "internal")
    return (
      <Link key={key} href={target.href} onClick={onNavigate}>
        {label}
      </Link>
    );
  if (target.kind === "text") return <span key={key}>{label}</span>;
  // A label can say anything; the domain beside it says where the click goes.
  const showsAddress = label === href || label === target.host;
  return (
    <a key={key} href={target.href} target="_blank" rel="noopener noreferrer">
      {label}
      {!showsAddress && <span className="font-normal text-muted-foreground"> ({target.host})</span>}
    </a>
  );
}
