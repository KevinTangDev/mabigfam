interface Link {
  parentId: string;
  childId: string;
}
interface Pair {
  aId: string;
  bId: string;
}

/**
 * Assigns each member a generation number, 0 being the oldest.
 *
 * A child sits one generation below its lowest-placed parent, and partners
 * share a generation — otherwise someone who married in (no recorded
 * parents) would be counted as a generation above the spouse they raised
 * children with. The two rules feed each other, so it iterates until nothing
 * moves; the cap only matters for malformed data, where it stops a cycle
 * that the API normally prevents from spinning forever.
 */
export function generationMap(
  memberIds: readonly string[],
  links: readonly Link[],
  partnerships: readonly Pair[],
): Map<string, number> {
  const gen = new Map(memberIds.map((id) => [id, 0]));
  const known = (id: string) => gen.has(id);

  for (let pass = 0; pass <= memberIds.length; pass++) {
    let changed = false;

    for (const { parentId, childId } of links) {
      if (!known(parentId) || !known(childId)) continue;
      const wanted = gen.get(parentId)! + 1;
      if (gen.get(childId)! < wanted) {
        gen.set(childId, wanted);
        changed = true;
      }
    }

    for (const { aId, bId } of partnerships) {
      if (!known(aId) || !known(bId)) continue;
      const shared = Math.max(gen.get(aId)!, gen.get(bId)!);
      if (gen.get(aId) !== shared || gen.get(bId) !== shared) {
        gen.set(aId, shared);
        gen.set(bId, shared);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return gen;
}

export function generationCount(generations: ReadonlyMap<string, number>): number {
  return generations.size === 0 ? 0 : Math.max(...generations.values()) + 1;
}
