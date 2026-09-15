import type { Node } from "relatives-tree/lib/types";

/**
 * The set of member ids reachable from `rootId` by following parent, child,
 * sibling and spouse links — i.e. "the same family" as opposed to an
 * unrelated branch that happens to share the same database.
 *
 * TreeView uses this to hand relatives-tree only the root's own family
 * rather than every member in the app. Two reasons:
 *
 * - Selecting someone with no relationships at all (or a founder in a
 *   separate branch) should show just them — or their own descendants — not
 *   a warning about every unrelated person elsewhere in the family tree.
 * - relatives-tree's layout code has to reason about "root families" when a
 *   node list spans multiple disconnected family groups; restricting the
 *   input to one connected family removes that entirely, which is the most
 *   likely source of the "can't access property pos" crash reported against
 *   a shape we could no longer reproduce once the data had changed.
 */
export function connectedComponent(rootId: string, nodes: readonly Node[]): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const queue = [rootId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = byId.get(id);
    if (!node) continue; // rootId (or a referenced relation) not in this node set

    for (const rel of [...node.parents, ...node.children, ...node.spouses, ...node.siblings]) {
      if (!visited.has(rel.id)) queue.push(rel.id);
    }
  }

  return visited;
}
