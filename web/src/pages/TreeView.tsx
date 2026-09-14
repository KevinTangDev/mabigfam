import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactFamilyTree from "react-family-tree";
import type { ExtNode } from "relatives-tree/lib/types";
import { api } from "../api/client";
import { buildRelativesTreeNodes } from "../lib/buildRelativesTree";
import FamilyNodeCard from "../components/FamilyNodeCard";
import type { FamilyMember, TreeData } from "../types";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 90;

export default function TreeView() {
  const { rootId: rootIdParam } = useParams<{ rootId?: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<TreeData | null>(null);
  const [rootId, setRootId] = useState<string>(rootIdParam ?? "");

  useEffect(() => {
    api.getTree().then((tree) => {
      setData(tree);
      if (!rootIdParam && tree.members.length > 0) {
        // Default to a member with no recorded parents (a "founder"), else the first member.
        const founder = tree.members.find(
          (m) => !tree.links.some((l) => l.childId === m.id),
        );
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
    );
  }, [data]);

  if (!data) return <p>Loading...</p>;

  if (data.members.length === 0) {
    return <p>No family members yet. Add some in the Table view first.</p>;
  }

  if (!rootId || !nodes.some((n) => n.id === rootId)) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <div className="toolbar">
        <label>
          Root:{" "}
          <select value={rootId} onChange={(e) => navigate(`/tree/${e.target.value}`)}>
            {data.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="tree-scroll">
        <ReactFamilyTree
          nodes={nodes}
          rootId={rootId}
          width={NODE_WIDTH}
          height={NODE_HEIGHT}
          className="tree-canvas"
          renderNode={(node: ExtNode) => (
            <FamilyNodeCard
              key={node.id}
              node={node}
              member={memberById.get(node.id)}
              isRoot={node.id === rootId}
              onSelect={(id) => navigate(`/members/${id}`)}
              style={{
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                transform: `translate(${node.left * (NODE_WIDTH / 2)}px, ${node.top * (NODE_HEIGHT / 2)}px)`,
              }}
            />
          )}
        />
      </div>
    </div>
  );
}
