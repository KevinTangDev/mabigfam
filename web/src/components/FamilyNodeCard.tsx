import { CSSProperties } from "react";
import type { ExtNode } from "relatives-tree/lib/types";
import Avatar from "./Avatar";
import type { FamilyMember } from "../types";

interface Props {
  node: ExtNode;
  member: FamilyMember | undefined;
  isRoot: boolean;
  style: CSSProperties;
  onSelect: (id: string) => void;
}

export default function FamilyNodeCard({ node, member, isRoot, style, onSelect }: Props) {
  return (
    <div
      className={`family-node${isRoot ? " family-node--root" : ""}${node.placeholder ? " family-node--placeholder" : ""}`}
      style={style}
      onClick={() => !node.placeholder && onSelect(node.id)}
    >
      {!node.placeholder && (
        <>
          <Avatar member={member} size={40} />
          <div className="family-node__text">
            <div className="family-node__name">{member?.name ?? "Unknown"}</div>
            {member?.nameZh && <div className="family-node__name-zh">{member.nameZh}</div>}
            {member?.birthday && (
              <div className="family-node__meta">{member.birthday.slice(0, 10)}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
