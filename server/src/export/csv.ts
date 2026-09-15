import type { FamilyMember } from "@prisma/client";

/**
 * RFC 4180 field: wrap in quotes when the value contains a comma, quote or
 * newline, and double any embedded quotes.
 */
function cell(value: string | null | undefined): string {
  const text = value ?? "";
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// U+FEFF as a named constant rather than a literal character in a template
// string — the raw character is invisible in an editor/diff and trips
// eslint's no-irregular-whitespace (correctly, for accidental cases; this
// one is deliberate, see membersToCsv below).
const UTF8_BOM = String.fromCharCode(0xfeff);

const HEADERS = [
  "Name",
  "Chinese name",
  "Birthday",
  "Phone",
  "Address",
  "Note",
  "Parents",
  "Children",
] as const;

export interface CsvRelations {
  parentNames: Map<string, string[]>;
  childNames: Map<string, string[]>;
}

/**
 * Members as CSV, including resolved parent/child names so the file is
 * readable on its own rather than full of opaque ids.
 *
 * Prefixed with a UTF-8 BOM: without it Excel on Windows decodes the file as
 * the local codepage and turns every Chinese name into mojibake.
 */
export function membersToCsv(members: FamilyMember[], relations: CsvRelations): string {
  const rows = members.map((m) =>
    [
      m.name,
      m.nameZh,
      m.birthday ? m.birthday.toISOString().slice(0, 10) : "",
      m.phone,
      m.address,
      m.note,
      (relations.parentNames.get(m.id) ?? []).join("; "),
      (relations.childNames.get(m.id) ?? []).join("; "),
    ].map(cell),
  );

  const lines = [HEADERS.map(cell).join(","), ...rows.map((r) => r.join(","))];

  return `${UTF8_BOM}${lines.join("\r\n")}\r\n`;
}
