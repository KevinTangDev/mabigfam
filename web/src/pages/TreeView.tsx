import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactFamilyTree from "react-family-tree";
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
    </div>
  );
}
