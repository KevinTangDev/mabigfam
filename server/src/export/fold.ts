/**
 * Line folding shared by the vCard and iCalendar writers.
 *
 * Both specs (RFC 6350 §3.2, RFC 5545 §3.1) cap a content line at 75 octets
 * and continue it on the next line prefixed with a single space. The limit is
 * in *octets*, not characters, and a multi-byte UTF-8 sequence must never be
 * split across the fold — doing so corrupts the character, which for this app
 * means mangled Chinese names. Long embedded photos make folding unavoidable
 * rather than cosmetic: some parsers reject over-long lines outright.
 */
const MAX_OCTETS = 75;

export function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= MAX_OCTETS) return line;

  const pieces: string[] = [];
  let start = 0;

  while (start < bytes.length) {
    // Continuation lines carry a leading space, which costs one octet.
    const budget = start === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
    let end = Math.min(start + budget, bytes.length);

    // Back off to a UTF-8 character boundary: 10xxxxxx marks a continuation
    // byte, so while we're on one we're mid-character.
    while (end > start && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) {
      end--;
    }

    pieces.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }

  return pieces.map((piece, i) => (i === 0 ? piece : ` ${piece}`)).join("\r\n");
}

/** Joins content lines with CRLF, folding each. Both specs require CRLF. */
export function serializeLines(lines: string[]): string {
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/**
 * Escapes a text value for vCard/iCalendar: backslash first (so we don't
 * double-escape what we add), then the structural separators, then newlines.
 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}
