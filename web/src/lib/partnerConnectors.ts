import type { ExtNode } from "relatives-tree/lib/types";
import type { Partnership, PartnershipStatus } from "../types";

export interface PartnerConnector {
  /** The two partnered member ids. */
  aId: string;
  bId: string;
  /** Midpoint between the pair, in relatives-tree's grid-unit coordinate
   *  space (the same units as ExtNode.left/top), for the caller to place a
   *  marker in. */
  x: number;
  y: number;
  status: PartnershipStatus | "inferred";
  since: string | null;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

/**
 * Turns the spouse relations relatives-tree laid out into drawable
 * partnership markers, one per rendered pair, positioned at the midpoint
 * between the two cards.
 *
 * relatives-tree's own connector lines (see index.css) carry no relation
 * type, so a married couple and a plain parent/child link render as the
 * identical grey segment. This walks the *rendered* nodes' spouse relations
 * instead, pairs them with the real Partnership record when one exists (for
 * its status and `since`), and falls back to "inferred" for the co-parent
 * pairs buildRelativesTree.ts invents when two people share a child but have
 * no recorded Partnership.
 */
export function buildPartnerConnectors(
  nodes: readonly ExtNode[],
  partnerships: readonly Partnership[],
): PartnerConnector[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const recorded = new Map<string, Partnership>();
  for (const p of partnerships) recorded.set(pairKey(p.aId, p.bId), p);

  const seen = new Set<string>();
  const connectors: PartnerConnector[] = [];

  for (const node of nodes) {
    for (const spouse of node.spouses) {
      const key = pairKey(node.id, spouse.id);
      if (seen.has(key)) continue;
      const other = byId.get(spouse.id);
      if (!other) continue; // the partner wasn't placed by this layout
      seen.add(key);

      const partnership = recorded.get(key);
      connectors.push({
        aId: node.id,
        bId: spouse.id,
        x: (node.left + other.left) / 2,
        y: (node.top + other.top) / 2,
        status: partnership?.status ?? "inferred",
        since: partnership?.since ?? null,
      });
    }
  }

  return connectors;
}
