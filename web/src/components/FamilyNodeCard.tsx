import type { CSSProperties } from "react";
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
  if (node.placeholder) {
    return (
      <div
        style={style}
        className="absolute rounded-xl border border-dashed border-ctp-surface1 bg-ctp-surface0/30"
      />
    );
  }

  return (
    <div
      style={style}
      onClick={() => onSelect(node.id)}
      className={
        "absolute flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-xl px-2.5 " +
        "shadow-sm transition hover:shadow-md " +
        (isRoot
          ? "border-2 border-ctp-mauve bg-ctp-mauve/10"
          : "border border-ctp-surface1 bg-ctp-mantle hover:border-ctp-blue")
      }
    >
      <Avatar member={member} size={40} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-ctp-text">
          {member?.name ?? "Unknown"}
        </div>
        {member?.nameZh && (
          <div className="truncate text-xs text-ctp-subtext0">{member.nameZh}</div>
        )}
        {member?.birthday && (
          <div className="text-[11px] text-ctp-overlay1">{member.birthday.slice(0, 10)}</div>
        )}
      </div>
    </div>
  );
}
