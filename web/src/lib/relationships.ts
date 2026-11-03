import type { FamilyMember, ParentChildLink, Partnership, PartnershipStatus } from "../types";

export interface Relations {
  parents: FamilyMember[];
  children: FamilyMember[];
  /** Anyone sharing at least one parent (full or half), excluding the member. */
  siblings: FamilyMember[];
  partners: { member: FamilyMember; status: PartnershipStatus }[];
}

/**
 * Indexes the raw tree payload once so each card can look its relatives up in
 * O(1) instead of rescanning every link per member.
 */
export function buildRelationIndex(data: {
  members: readonly FamilyMember[];
  links: readonly ParentChildLink[];
  partnerships: readonly Partnership[];
}): (id: string) => Relations {
  const byId = new Map(data.members.map((m) => [m.id, m]));
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const partnersOf = new Map<string, { id: string; status: PartnershipStatus }[]>();

  const push = <V>(map: Map<string, V[]>, key: string, value: V) =>
    map.set(key, [...(map.get(key) ?? []), value]);

  for (const l of data.links) {
    push(parentsOf, l.childId, l.parentId);
    push(childrenOf, l.parentId, l.childId);
  }
  for (const p of data.partnerships) {
    push(partnersOf, p.aId, { id: p.bId, status: p.status });
    push(partnersOf, p.bId, { id: p.aId, status: p.status });
  }

  const resolve = (ids: readonly string[] | undefined) =>
    [...new Set(ids ?? [])].map((id) => byId.get(id)).filter((m): m is FamilyMember => !!m);

  return (id) => {
    const siblingIds = (parentsOf.get(id) ?? []).flatMap((p) => childrenOf.get(p) ?? []);
    return {
      parents: resolve(parentsOf.get(id)),
      children: resolve(childrenOf.get(id)),
      siblings: resolve(siblingIds.filter((s) => s !== id)),
      partners: (partnersOf.get(id) ?? [])
        .map((p) => ({ member: byId.get(p.id), status: p.status }))
        .filter((p): p is { member: FamilyMember; status: PartnershipStatus } => !!p.member),
    };
  };
}

const first = (m: FamilyMember) => m.name.split(" ")[0]!;

const PARTNER_PHRASE: Record<PartnershipStatus, string> = {
  married: "Married to",
  partner: "Partner of",
  divorced: "Formerly married to",
};

/** Short, human phrases for a card: "Child of Hung & Mou", "Married to Anna", "2 children". */
export function relationshipLabels(rel: Relations): string[] {
  const labels: string[] = [];
  if (rel.parents.length > 0) labels.push(`Child of ${rel.parents.map(first).join(" & ")}`);
  for (const p of rel.partners) labels.push(`${PARTNER_PHRASE[p.status]} ${first(p.member)}`);
  if (rel.children.length > 0) {
    labels.push(rel.children.length === 1 ? "1 child" : `${rel.children.length} children`);
  }
  return labels;
}
