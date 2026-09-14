import { describe, expect, it } from "vitest";
import { escapeText, foldLine, serializeLines } from "../src/export/fold.js";

describe("foldLine", () => {
  it("leaves a short line alone", () => {
    expect(foldLine("SUMMARY:Dinner")).toBe("SUMMARY:Dinner");
  });

  it("leaves a line of exactly 75 octets alone", () => {
    const line = "A".repeat(75);
    expect(foldLine(line)).toBe(line);
  });

  it("folds at 75 octets with a leading space on continuations", () => {
    const folded = foldLine("B".repeat(200));
    const parts = folded.split("\r\n");

    expect(parts[0]).toHaveLength(75);
    for (const part of parts.slice(1)) {
      expect(part.startsWith(" ")).toBe(true);
      expect(Buffer.byteLength(part, "utf8")).toBeLessThanOrEqual(75);
    }
    // Unfolding restores the original.
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe("B".repeat(200));
  });

  it("never splits a multi-byte character", () => {
    // Each of these is 3 octets, so a naive 75-byte cut lands mid-character.
    const line = `NICKNAME:${"測".repeat(80)}`;
    const folded = foldLine(line);

    expect(folded).not.toContain("�");
    for (const part of folded.split("\r\n")) {
      expect(Buffer.byteLength(part, "utf8")).toBeLessThanOrEqual(75);
    }

    const unfolded = folded
      .split("\r\n")
      .map((p, i) => (i === 0 ? p : p.slice(1)))
      .join("");
    expect(unfolded).toBe(line);
  });

  it("keeps emoji intact when folding", () => {
    const line = `SUMMARY:${"🎂".repeat(40)}`;
    const folded = foldLine(line);
    expect(folded).not.toContain("�");

    const unfolded = folded
      .split("\r\n")
      .map((p, i) => (i === 0 ? p : p.slice(1)))
      .join("");
    expect(unfolded).toBe(line);
  });
});

describe("escapeText", () => {
  it("escapes the structural separators", () => {
    expect(escapeText("a;b,c")).toBe("a\\;b\\,c");
  });

  it("escapes backslashes before anything else, not twice", () => {
    expect(escapeText("back\\slash")).toBe("back\\\\slash");
    expect(escapeText("a\\;b")).toBe("a\\\\\\;b");
  });

  it("turns newlines into literal \\n", () => {
    expect(escapeText("one\ntwo")).toBe("one\\ntwo");
    expect(escapeText("one\r\ntwo")).toBe("one\\ntwo");
    expect(escapeText("one\rtwo")).toBe("one\\ntwo");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeText("Grandma's house")).toBe("Grandma's house");
  });
});

describe("serializeLines", () => {
  it("joins with CRLF and ends with one", () => {
    expect(serializeLines(["A", "B"])).toBe("A\r\nB\r\n");
  });
});
