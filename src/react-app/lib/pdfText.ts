// jsPDF renders with the standard-14 PDF fonts (Times/Helvetica/Courier),
// which use WinAnsi / CP1252 encoding. Any character outside that set renders
// as a WRONG glyph or a blank - most visibly the Indian Rupee sign (U+20B9),
// which these INR-denominated memos use for every price / EPS / target figure
// and which jsPDF turns into a wrong glyph ("¹"). The wrong glyph also has a
// different advance width, so positioning drifts and runs get smeared apart.
//
// Embedding a full Unicode font would add hundreds of KB to the lazy-loaded
// PDF chunk, so instead we transliterate the handful of non-WinAnsi characters
// that actually occur in these memos to faithful ASCII / WinAnsi equivalents.
// The output stays real, selectable, searchable text.

// Smart punctuation that IS renderable by the standard fonts (it maps into the
// CP1252 0x80-0x9F band even though its Unicode codepoint is > 0x00FF): curly
// quotes, en/em dashes, bullet, ellipsis, dagger, euro, trademark, etc. These
// pass through untouched so the memo keeps its typography.
const RENDERABLE_HIGH = new Set<number>([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

// nbsp / figure / thin / hair / narrow-nbsp -> collapse to a normal space.
const SPACE_LIKE = new Set<number>([0x00a0, 0x2007, 0x2009, 0x200a, 0x202f]);
// zero-width space / non-joiner / joiner / BOM -> drop.
const ZERO_WIDTH = new Set<number>([0x200b, 0x200c, 0x200d, 0xfeff]);

// Ordered transliterations for the visible non-WinAnsi symbols that show up in
// equity / INR memos. The Rupee sign is the dominant one; the rest are
// defensive. (Invisible code points are handled numerically below.)
const TRANSLITERATIONS: Array<[RegExp, string]> = [
  [/₹\s*/g, "Rs "], // Rupee sign -> "Rs " (collapses a trailing space)
  [/[→⇒]/g, "->"], // right arrow / double arrow
  [/[←⇐]/g, "<-"], // left arrow / double arrow
  [/≈/g, "~"], // almost-equal
  [/≤/g, "<="], // less-than-or-equal
  [/≥/g, ">="], // greater-than-or-equal
  [/≠/g, "!="], // not-equal
  [/−/g, "-"], // minus sign (not an ASCII hyphen)
];

// Make a string safe to render with jsPDF's standard fonts. Known non-WinAnsi
// symbols are transliterated; anything else outside the renderable set becomes
// "?" so it can never silently turn into a broken glyph.
export function pdfSafeText(input: string): string {
  if (!input) return "";
  let s = input;
  for (const [re, rep] of TRANSLITERATIONS) s = s.replace(re, rep);
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (SPACE_LIKE.has(cp)) {
      out += " ";
    } else if (ZERO_WIDTH.has(cp)) {
      // drop
    } else if (cp <= 0x00ff || RENDERABLE_HIGH.has(cp)) {
      out += ch;
    } else {
      out += "?";
    }
  }
  return out;
}
