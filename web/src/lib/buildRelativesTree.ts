import type { Gender, Node, Relation, RelType } from "relatives-tree/lib/types";
import type { ParentChildLink } from "../types";

// relatives-tree declares Gender/RelType as *ambient* const enums, which
// can't be referenced as values under Vite/esbuild's isolatedModules — so we
// use the underlying string literals (documented in relatives-tree/lib/types.d.ts)
// typed via `as` instead of importing the enum objects themselves.
const GENDER_MALE = "male" as Gender;
const REL_BLOOD = "blood" as RelType;
const REL_MARRIED = "married" as RelType;

/**
 * relatives-tree needs a full graph of parents/children/siblings/spouses per
 * node (see node_modules/relatives-tree/lib/types.d.ts). Our schema only
 * stores ParentChild rows, so we derive siblings (members who share a
 * parent) and spouses (members who share a child) from that data here.
 *
 * We don't track gender, so every node is given a fixed placeholder gender —
 * it only affects relatives-tree's own styling, which we override with a
 * custom renderNode anyway.
 */
export function buildRelativesTreeNodes(memberIds: string[], links: ParentChildLink[]): Node[] {
  const parentsOf = new Map<string, Set<string>>();
  const childrenOf = new Map<string, Set<string>>();

  for (const id of memberIds) {
    parentsOf.set(id, new Set());
    childrenOf.set(id, new Set());
  }

  for (const link of links) {
    if (!parentsOf.has(link.childId) || !childrenOf.has(link.parentId)) continue; // skip dangling links
    parentsOf.get(link.childId)!.add(link.parentId);
    childrenOf.get(link.parentId)!.add(link.childId);
  }

  const siblingsOf = new Map<string, Set<string>>();
  const spousesOf = new Map<string, Set<string>>();
  for (const id of memberIds) {
    siblingsOf.set(id, new Set());
    spousesOf.set(id, new Set());
  }

  // Siblings: share at least one parent.
  for (const id of memberIds) {
    const myParents = parentsOf.get(id)!;
    if (myParents.size === 0) continue;
    for (const parentId of myParents) {
      for (const siblingId of childrenOf.get(parentId) ?? []) {
        if (siblingId !== id) siblingsOf.get(id)!.add(siblingId);
      }
    }
  }

  // Spouses: co-parent at least one child together.
  for (const id of memberIds) {
    for (const childId of childrenOf.get(id) ?? []) {
      for (const coParentId of parentsOf.get(childId) ?? []) {
        if (coParentId !== id) spousesOf.get(id)!.add(coParentId);
      }
    }
  }

  const toRelations = (ids: Set<string>): Relation[] =>
    [...ids].map((relId) => ({ id: relId, type: REL_BLOOD }));

  return memberIds.map((id) => ({
    id,
    gender: GENDER_MALE,
    parents: toRelations(parentsOf.get(id)!),
    children: toRelations(childrenOf.get(id)!),
    siblings: toRelations(siblingsOf.get(id)!),
    spouses: [...spousesOf.get(id)!].map((relId) => ({ id: relId, type: REL_MARRIED })),
  }));
}
