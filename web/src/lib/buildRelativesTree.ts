import type { Gender, Node, Relation, RelType } from "relatives-tree/lib/types";
import type { Partnership, ParentChildLink } from "../types";

// relatives-tree declares Gender/RelType as *ambient* const enums, which
// can't be referenced as values under Vite/esbuild's isolatedModules — so we
// use the underlying string literals (documented in relatives-tree/lib/types.d.ts)
// typed via `as` instead of importing the enum objects themselves.
const GENDER_MALE = "male" as Gender;
const REL_BLOOD = "blood" as RelType;
const REL_HALF = "half" as RelType;
const REL_MARRIED = "married" as RelType;
const REL_DIVORCED = "divorced" as RelType;

function relTypeForStatus(status: string): RelType {
  return status === "divorced" ? REL_DIVORCED : REL_MARRIED;
}

/**
 * relatives-tree needs a full graph of parents/children/siblings/spouses per
 * node (see node_modules/relatives-tree/lib/types.d.ts).
 *
 * Parents and children come straight from ParentChild rows. Spouses prefer
 * explicit Partnership records; where a couple has no record but shares a
 * child, they're still inferred as partners so older data keeps rendering as
 * a couple. Siblings are always derived from shared parents.
 *
 * We don't track gender, so every node is given a fixed placeholder gender —
 * it only affects relatives-tree's own styling, which we override with a
 * custom renderNode anyway.
 */
export function buildRelativesTreeNodes(
  memberIds: string[],
  links: ParentChildLink[],
  partnerships: Partnership[] = [],
): Node[] {
  const parentsOf = new Map<string, Set<string>>();
  const childrenOf = new Map<string, Set<string>>();
  const siblingsOf = new Map<string, Set<string>>();
  /** partner id -> relationship type, so divorced pairs render differently. */
  const partnersOf = new Map<string, Map<string, RelType>>();

  const known = new Set(memberIds);

  for (const id of memberIds) {
    parentsOf.set(id, new Set());
    childrenOf.set(id, new Set());
    siblingsOf.set(id, new Set());
    partnersOf.set(id, new Map());
  }

  for (const link of links) {
    if (!known.has(link.childId) || !known.has(link.parentId)) continue; // dangling
    parentsOf.get(link.childId)!.add(link.parentId);
    childrenOf.get(link.parentId)!.add(link.childId);
  }

  // Siblings: share at least one parent. Sharing *every* parent counts as a
  // full sibling, otherwise it's a half sibling.
  for (const id of memberIds) {
    const myParents = parentsOf.get(id)!;
    if (myParents.size === 0) continue;

    for (const parentId of myParents) {
      for (const siblingId of childrenOf.get(parentId) ?? []) {
        if (siblingId !== id) siblingsOf.get(id)!.add(siblingId);
      }
    }
  }

  // Explicit partnerships win.
  for (const partnership of partnerships) {
    if (!known.has(partnership.aId) || !known.has(partnership.bId)) continue;
    const type = relTypeForStatus(partnership.status);
    partnersOf.get(partnership.aId)!.set(partnership.bId, type);
    partnersOf.get(partnership.bId)!.set(partnership.aId, type);
  }

  // Fallback: co-parents of the same child, unless already recorded above.
  for (const id of memberIds) {
    for (const childId of childrenOf.get(id) ?? []) {
      for (const coParentId of parentsOf.get(childId) ?? []) {
        if (coParentId === id) continue;
        if (!partnersOf.get(id)!.has(coParentId)) {
          partnersOf.get(id)!.set(coParentId, REL_MARRIED);
        }
      }
    }
  }

  const siblingRelations = (id: string): Relation[] => {
    const myParents = parentsOf.get(id)!;
    return [...siblingsOf.get(id)!].map((siblingId) => {
      const theirParents = parentsOf.get(siblingId)!;
      const shareAll =
        myParents.size === theirParents.size &&
        [...myParents].every((p) => theirParents.has(p));
      return { id: siblingId, type: shareAll ? REL_BLOOD : REL_HALF };
    });
  };

  const bloodRelations = (ids: Set<string>): Relation[] =>
    [...ids].map((relId) => ({ id: relId, type: REL_BLOOD }));

  return memberIds.map((id) => ({
    id,
    gender: GENDER_MALE,
    parents: bloodRelations(parentsOf.get(id)!),
    children: bloodRelations(childrenOf.get(id)!),
    siblings: siblingRelations(id),
    spouses: [...partnersOf.get(id)!].map(([relId, type]) => ({ id: relId, type })),
  }));
}
