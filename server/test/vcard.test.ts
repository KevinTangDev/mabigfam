import { describe, expect, it } from "vitest";
import type { FamilyMember } from "@prisma/client";
import { memberToVCard, membersToVCards, mimeToVCardType } from "../src/export/vcard.js";

function member(over: Partial<FamilyMember> = {}): FamilyMember {
  return {
    id: "m1",
    name: "Kevin TANG",
    nameZh: null,
    birthday: null,
    phone: null,
    address: null,
    note: null,
    photoPath: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-02-03T04:05:06Z"),
    ...over,
  };
}

/** Reverses the spec line folding, the way a real parser would. */
function unfold(vcf: string): string[] {
  return vcf.replace(/\r\n /g, "").split("\r\n").filter(Boolean);
}

describe("memberToVCard", () => {
  it("wraps the card and declares version 3.0", () => {
    const lines = unfold(memberToVCard(member()));
    expect(lines[0]).toBe("BEGIN:VCARD");
    expect(lines[1]).toBe("VERSION:3.0");
    expect(lines.at(-1)).toBe("END:VCARD");
  });

  it("uses CRLF line endings", () => {
    expect(memberToVCard(member())).toContain("\r\n");
  });

  it("sets FN and a structured N", () => {
    const lines = unfold(memberToVCard(member()));
    expect(lines).toContain("FN:Kevin TANG");
    expect(lines).toContain("N:;Kevin TANG;;;");
  });

  it("puts the Chinese name in NICKNAME", () => {
    const lines = unfold(memberToVCard(member({ nameZh: "鄧凱文" })));
    expect(lines).toContain("NICKNAME:鄧凱文");
  });

  it("omits optional properties that are not set", () => {
    const vcf = memberToVCard(member());
    expect(vcf).not.toContain("NICKNAME");
    expect(vcf).not.toContain("TEL");
    expect(vcf).not.toContain("ADR");
    expect(vcf).not.toContain("BDAY");
    expect(vcf).not.toContain("NOTE");
    expect(vcf).not.toContain("PHOTO");
  });

  it("writes the address into the street component of ADR", () => {
    const lines = unfold(memberToVCard(member({ address: "12 Rue de la Paix" })));
    expect(lines).toContain("ADR;TYPE=HOME:;;12 Rue de la Paix;;;;");
  });

  it("escapes separators in text values", () => {
    const lines = unfold(memberToVCard(member({ note: "a;b,c", address: "x, y" })));
    expect(lines).toContain("NOTE:a\\;b\\,c");
    expect(lines).toContain("ADR;TYPE=HOME:;;x\\, y;;;;");
  });

  it("formats BDAY as a plain date", () => {
    const lines = unfold(memberToVCard(member({ birthday: new Date("1988-03-25T00:00:00Z") })));
    expect(lines).toContain("BDAY:1988-03-25");
  });

  it("emits a stable UID so re-imports update rather than duplicate", () => {
    const a = unfold(memberToVCard(member({ id: "abc" })));
    const b = unfold(memberToVCard(member({ id: "abc", phone: "123" })));
    expect(a).toContain("UID:mabigfam-abc");
    expect(b).toContain("UID:mabigfam-abc");
  });

  it("emits REV as a compact UTC timestamp", () => {
    const lines = unfold(memberToVCard(member()));
    expect(lines).toContain("REV:20260203T040506Z");
  });

  it("embeds a photo with its type", () => {
    const lines = unfold(memberToVCard(member(), { base64: "QUJD", type: "JPEG" }));
    expect(lines).toContain("PHOTO;ENCODING=b;TYPE=JPEG:QUJD");
  });

  it("folds long photo data to 75 octets per line", () => {
    const vcf = memberToVCard(member(), { base64: "Q".repeat(500), type: "PNG" });
    for (const line of vcf.split("\r\n").filter(Boolean)) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
    // And it survives unfolding.
    expect(unfold(vcf)).toContain(`PHOTO;ENCODING=b;TYPE=PNG:${"Q".repeat(500)}`);
  });

  it("keeps a Chinese name intact through folding", () => {
    const vcf = memberToVCard(member({ note: "測".repeat(100) }));
    expect(vcf).not.toContain("�");
    expect(unfold(vcf)).toContain(`NOTE:${"測".repeat(100)}`);
  });
});

describe("membersToVCards", () => {
  it("concatenates one card per member", () => {
    const vcf = membersToVCards(
      [member({ id: "a", name: "A" }), member({ id: "b", name: "B" })],
      new Map(),
    );
    expect(vcf.match(/BEGIN:VCARD/g)).toHaveLength(2);
    expect(vcf.match(/END:VCARD/g)).toHaveLength(2);
  });

  it("attaches photos only to the members that have one", () => {
    const vcf = membersToVCards(
      [member({ id: "a", name: "A" }), member({ id: "b", name: "B" })],
      new Map([["a", { base64: "QUJD", type: "JPEG" }]]),
    );
    expect(vcf.match(/PHOTO/g)).toHaveLength(1);
  });

  it("returns an empty string for no members", () => {
    expect(membersToVCards([], new Map())).toBe("");
  });
});

describe("mimeToVCardType", () => {
  it("maps mime types to vCard type tokens", () => {
    expect(mimeToVCardType("image/jpeg")).toBe("JPEG");
    expect(mimeToVCardType("image/png")).toBe("PNG");
    expect(mimeToVCardType("image/webp")).toBe("WEBP");
  });

  it("falls back to JPEG when there is no subtype to read", () => {
    expect(mimeToVCardType("nonsense")).toBe("JPEG");
    expect(mimeToVCardType("")).toBe("JPEG");
  });

  it("uppercases whatever subtype it is given", () => {
    expect(mimeToVCardType("image/gif")).toBe("GIF");
  });
});
