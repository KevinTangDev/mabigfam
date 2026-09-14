import { describe, expect, it } from "vitest";
import type { FamilyMember } from "@prisma/client";
import { membersToCsv } from "../src/export/csv.js";

function member(over: Partial<FamilyMember> = {}): FamilyMember {
  return {
    id: "m1",
    name: "Ah Gong",
    nameZh: null,
    birthday: null,
    phone: null,
    address: null,
    note: null,
    photoPath: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

const noRelations = { parentNames: new Map(), childNames: new Map() };

describe("membersToCsv", () => {
  it("starts with a UTF-8 BOM so Excel doesn't mangle Chinese names", () => {
    const csv = membersToCsv([], noRelations);
    expect(Buffer.from(csv, "utf8").subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  });

  it("writes a header row", () => {
    const csv = membersToCsv([], noRelations);
    expect(csv.replace("﻿", "").split("\r\n")[0]).toBe(
      "Name,Chinese name,Birthday,Phone,Address,Note,Parents,Children",
    );
  });

  it("quotes fields containing a comma", () => {
    const csv = membersToCsv([member({ name: "Tang, Kevin" })], noRelations);
    expect(csv).toContain('"Tang, Kevin"');
  });

  it("doubles embedded quotes", () => {
    const csv = membersToCsv([member({ note: 'He said "hi"' })], noRelations);
    expect(csv).toContain('"He said ""hi"""');
  });

  it("quotes fields containing a newline, preserving it", () => {
    const csv = membersToCsv([member({ note: "line one\nline two" })], noRelations);
    expect(csv).toContain('"line one\nline two"');
  });

  it("leaves Chinese characters unescaped", () => {
    const csv = membersToCsv([member({ nameZh: "阿公" })], noRelations);
    expect(csv).toContain("阿公");
  });

  it("formats the birthday as a plain date", () => {
    const csv = membersToCsv(
      [member({ birthday: new Date("1988-03-25T00:00:00Z") })],
      noRelations,
    );
    expect(csv).toContain("1988-03-25");
  });

  it("renders empty cells for missing optional fields", () => {
    const csv = membersToCsv([member()], noRelations);
    const row = csv.replace("﻿", "").split("\r\n")[1];
    expect(row).toBe("Ah Gong,,,,,,,");
  });

  it("joins resolved parent and child names", () => {
    const csv = membersToCsv([member({ id: "kid", name: "Kid" })], {
      parentNames: new Map([["kid", ["Mum", "Dad"]]]),
      childNames: new Map([["kid", ["Grandkid"]]]),
    });
    expect(csv).toContain("Mum; Dad");
    expect(csv).toContain("Grandkid");
  });

  it("quotes a relation list whose names contain commas", () => {
    const csv = membersToCsv([member({ id: "kid", name: "Kid" })], {
      parentNames: new Map([["kid", ["Tang, Senior", "Mum"]]]),
      childNames: new Map(),
    });
    expect(csv).toContain('"Tang, Senior; Mum"');
  });
});
