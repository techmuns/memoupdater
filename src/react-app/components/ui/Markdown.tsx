import { Fragment, type ReactNode } from "react";

// Lightweight Markdown renderer for research-report prose. Deliberately small —
// it handles exactly what the report produces: headings, bold, bullet/numbered
// lists, GitHub-style pipe tables, and paragraphs. No external dependency, no
// raw HTML injection (everything is React nodes).

interface MarkdownProps {
  text: string;
  className?: string;
}

export function Markdown({ text, className }: MarkdownProps) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const isTableSep = (l: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.includes("-");
  const isTableRow = (l: string) => l.trim().startsWith("|") || (l.includes("|") && l.trim().length > 0);

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Table: a row line followed by a separator line
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i]) && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={key++} className="my-3 overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr>
                {header.map((h, hi) => (
                  <th
                    key={hi}
                    className="text-left font-semibold text-[var(--color-text)] border-b border-[var(--color-border-strong)] px-2.5 py-1.5 align-top"
                  >
                    <Inline text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-[var(--color-border)]">
                  {r.map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-2.5 py-1.5 text-[var(--color-text-muted)] align-top"
                    >
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Headings
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const size = level <= 1 ? "text-[16px]" : level === 2 ? "text-[14.5px]" : "text-[13px]";
      blocks.push(
        <div
          key={key++}
          className={`${size} font-semibold text-[var(--color-text)] mt-4 mb-1.5`}
        >
          <Inline text={h[2]} />
        </div>,
      );
      i++;
      continue;
    }

    // Bullet / numbered list
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: string[] = [];
      const ordered = /^\s*\d+\.\s+/.test(line);
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        i++;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag
          key={key++}
          className={`my-2 space-y-1 ${ordered ? "list-decimal" : "list-disc"} pl-5 text-[13px] text-[var(--color-text-muted)] leading-relaxed`}
        >
          {items.map((it, ii) => (
            <li key={ii}>
              <Inline text={it} />
            </li>
          ))}
        </ListTag>,
      );
      continue;
    }

    // Paragraph (consume until blank or a block starter)
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*([-*]|\d+\.)\s+/.test(lines[i]) &&
      !(isTableRow(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1]))
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p
        key={key++}
        className="my-2 text-[13px] text-[var(--color-text-muted)] leading-relaxed"
      >
        <Inline text={para.join(" ")} />
      </p>,
    );
  }

  return <div className={className}>{blocks}</div>;
}

// Inline formatting: **bold** and `code`. Everything else is literal text.
function Inline({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    if (m[2] !== undefined) {
      parts.push(
        <strong key={key++} className="font-semibold text-[var(--color-text)]">
          {m[2]}
        </strong>,
      );
    } else if (m[3] !== undefined) {
      parts.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded bg-[var(--color-surface-muted)] text-[12px] font-mono"
        >
          {m[3]}
        </code>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return <>{parts}</>;
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}
