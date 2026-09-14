import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactFamilyTree from "react-family-tree";
import calcTree from "relatives-tree";
import type { ExtNode } from "relatives-tree/lib/types";
import { api } from "../api/client";
import { buildRelativesTreeNodes } from "../lib/buildRelativesTree";
import FamilyNodeCard from "../components/FamilyNodeCard";
import { cardClass, inputClass } from "../components/ui";
import type { FamilyMember, TreeData } from "../types";

/**
 * relatives-tree positions nodes on a grid of NODE_WIDTH x NODE_HEIGHT cells
 * and draws its connector lines between cell centres. Rendering a card at the
 * full cell size therefore covers those lines and leaves cards touching.
 *
 * So the cell is deliberately larger than the card: the difference is the
 * gutter, and the connectors show through it as the ancestry lines.
 */
const CELL_WIDTH = 220;
const CELL_HEIGHT = 140;
const CARD_GUTTER_X = 26;
const CARD_GUTTER_Y = 34;

const CARD_WIDTH = CELL_WIDTH - CARD_GUTTER_X * 2;
const CARD_HEIGHT = CELL_HEIGHT - CARD_GUTTER_Y * 2;

export default function TreeView() {
  const { rootId: rootIdParam } = useParams<{ rootId?: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<TreeData | null>(null);
  const [rootId, setRootId] = useState<string>(rootIdParam ?? "");

  useEffect(() => {
    api.getTree().then((tree) => {
      setData(tree);
      if (!rootIdParam && tree.members.length > 0) {
        // Default to a member with no recorded parents (a "founder"), else the first.
        const founder = tree.members.find((m) => !tree.links.some((l) => l.childId === m.id));
        setRootId((founder ?? tree.members[0]).id);
      }
    });
  }, [rootIdParam]);

  useEffect(() => {
    if (rootIdParam) setRootId(rootIdParam);
  }, [rootIdParam]);

  const memberById = useMemo(() => {
    const map = new Map<string, FamilyMember>();
    data?.members.forEach((m) => map.set(m.id, m));
    return map;
  }, [data]);

  const nodes = useMemo(() => {
    if (!data) return [];
    return buildRelativesTreeNodes(
      data.members.map((m) => m.id),
      data.links,
      data.partnerships,
    );
  }, [data]);

  /*
   * relatives-tree is run here first, in a try/catch, before handing the same
   * graph to <ReactFamilyTree> (which calls it internally). Two reasons:
   *
   * 1. Its layout code can throw on graph shapes it doesn't model — and a
   *    throw inside render blanks the page. Catching it turns that into a
   *    message that says which family is involved.
   * 2. It only lays out the family reachable from the root *through couples*,
   *    so some members can be silently absent. Comparing its output against
   *    the member list is the only way to tell the user who's missing.
   */
  const layout = useMemo(() => {
    if (!rootId || !nodes.some((n) => n.id === rootId)) return null;
    try {
      return { nodes: calcTree(nodes, { rootId }).nodes, error: null as string | null };
    } catch (err) {
      return {
        nodes: [],
        error: err instanceof Error ? err.message : "The tree layout failed unexpectedly.",
      };
    }
  }, [nodes, rootId]);

  const missing = useMemo(() => {
    if (!data || !layout || layout.error) return [];
    const shown = new Set(layout.nodes.map((n) => n.id));
    return data.members.filter((m) => !shown.has(m.id));
  }, [data, layout]);

  if (!data) return <p className="text-sm text-ctp-subtext0">Loading...</p>;

  if (data.members.length === 0) {
    return (
      <div className={`${cardClass} p-10 text-center text-sm text-ctp-subtext0`}>
        No family members yet. Add some in the Table view first.
      </div>
    );
  }

  if (!rootId || !nodes.some((n) => n.id === rootId)) {
    return <p className="text-sm text-ctp-subtext0">Loading...</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ctp-subtext0">
          Viewing from
          <select
            value={rootId}
            onChange={(e) => navigate(`/tree/${e.target.value}`)}
            className={`${inputClass} max-w-xs`}
          >
            {data.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-ctp-overlay1">Click anyone to open their profile</span>
      </div>

      {layout?.error && (
        <div className={`${cardClass} border-ctp-red/40 p-5`}>
          <h3 className="font-semibold text-ctp-red">This family can't be laid out</h3>
          <p className="mt-2 text-sm text-ctp-subtext0">
            The tree layout library couldn't arrange these relationships. Picking a different
            person above usually works. It's often caused by a relationship that's only recorded
            on one side — check that children have both parents linked.
          </p>
          <pre className="mt-3 overflow-auto rounded-lg bg-ctp-crust/60 p-3 text-xs text-ctp-peach">
            {layout.error}
          </pre>
        </div>
      )}

      {missing.length > 0 && (
        <div className={`${cardClass} mb-4 border-ctp-yellow/40 p-4`}>
          <h3 className="text-sm font-semibold text-ctp-yellow">
            {missing.length} {missing.length === 1 ? "person isn't" : "people aren't"} shown here
          </h3>
          <p className="mt-1 text-sm text-ctp-subtext0">
            This view only draws the family connected to{" "}
            <strong>{memberById.get(rootId)?.name}</strong> through parent and partner links.
            Someone with only one parent recorded, whose parent has a partner, also falls outside
            it — linking their second parent usually brings them in.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {missing.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => navigate(`/tree/${m.id}`)}
                  className="cursor-pointer rounded-full border border-ctp-surface1 bg-ctp-surface0
                             px-2.5 py-1 text-xs font-medium text-ctp-text transition
                             hover:border-ctp-blue"
                  title={`View the tree from ${m.name}`}
                >
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!layout?.error && (
        <div className={`${cardClass} max-h-[75vh] overflow-auto p-6`}>
          <ReactFamilyTree
            nodes={nodes}
            rootId={rootId}
            width={CELL_WIDTH}
            height={CELL_HEIGHT}
            className="tree-canvas"
            renderNode={(node: ExtNode) => (
              <FamilyNodeCard
                key={node.id}
                node={node}
                member={memberById.get(node.id)}
                isRoot={node.id === rootId}
                onSelect={(id) => navigate(`/members/${id}`)}
                style={{
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                  // Offset by the gutter so the card sits inset within its cell.
                  transform: `translate(${node.left * (CELL_WIDTH / 2) + CARD_GUTTER_X}px, ${
                    node.top * (CELL_HEIGHT / 2) + CARD_GUTTER_Y
                  }px)`,
                }}
              />
            )}
          />
        </div>
      )}
    </div>
  );
}
