import { describe, expect, it } from "vitest";
import { createI18n } from "../src/i18n/config";
import { buildRelationIndex, relationshipLabels } from "../src/lib/relationships";

import type { FamilyMember } from "../src/types";

const t = createI18n("en").t;

const person = (id: string, name: string): FamilyMember => ({
  id,
  name,
  nameZh: null,
  birthday: null,
  phone: null,
  address: null,
  note: null,
  photoPath: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
});

const members = [
  person("hung", "Hung TANG"),
  person("mou", "Mou TANG"),
  person("kevin", "Kevin TANG"),
  person("thierry", "Thierry TANG"),
  person("half", "Half Sibling"),
];
const link = (parentId: string, childId: string) => ({ id: `${parentId}-${childId}`, parentId, childId, createdAt: "" });

const index = buildRelationIndex({
  members,
  links: [link("hung", "kevin"), link("mou", "kevin"), link("hung", "thierry"), link("mou", "thierry"), link("hung", "half")],
  partnerships: [
    { id: "p", aId: "hung", bId: "mou", status: "married", since: null, createdAt: "", updatedAt: "" },
  ],
});

describe("relationships", () => {
  it("finds parents, children, partners and siblings (including half-siblings, once each)", () => {
    const kevin = index("kevin");
    expect(kevin.parents.map((m) => m.id).sort()).toEqual(["hung", "mou"]);
    expect(kevin.siblings.map((m) => m.id).sort()).toEqual(["half", "thierry"]);
    expect(index("hung").children).toHaveLength(3);
    expect(index("mou").partners[0]).toMatchObject({ status: "married", member: { id: "hung" } });
  });

  it("builds short card labels", () => {
    expect(relationshipLabels(index("kevin"), t)).toEqual(["Child of Hung & Mou"]);
    expect(relationshipLabels(index("hung"), t)).toEqual(["Married to Mou", "3 children"]);
    expect(relationshipLabels(index("half"), t)).toEqual(["Child of Hung"]);
  });

  it("returns empty relations for someone unconnected", () => {
    const lone = buildRelationIndex({ members: [person("x", "Solo")], links: [], partnerships: [] })("x");
    expect(relationshipLabels(lone, t)).toEqual([]);
  });
});
