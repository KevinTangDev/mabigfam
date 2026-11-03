import type { CSSProperties } from "react";
import type { ExtNode } from "relatives-tree/lib/types";
import Avatar from "./Avatar";
import Icon from "./icons";
import type { FamilyMember } from "../types";

interface Props {
  node: ExtNode;
  member: FamilyMember | undefined;
  isRoot: boolean;
  style: CSSProperties;
  onSelect: (id: string) => void;
  /** Re-centre the tree on this person. */
  onFocusTree: (id: string) => void;
}

export default function FamilyNodeCard({ node, member, isRoot, style, onSelect, onFocusTree }: Props) {
  if (node.placeholder) {
    return (
      <div
        style={style}
        className="absolute rounded-2xl border border-dashed border-ctp-surface1 bg-ctp-surface0/30"
      />
    );
  }

  const name = member?.name ?? "Unknown";
  const year = member?.birthday ? new Date(member.birthday).getUTCFullYear() : null;

  return (
    <div
      style={style}
      className={
        "group absolute flex items-center gap-3 rounded-2xl border px-3 shadow-card transition " +
        "duration-150 hover:shadow-pop " +
        (isRoot
          ? "border-brand bg-brand/8 ring-2 ring-brand/25"
          : "border-ctp-surface1 bg-ctp-mantle hover:border-brand/50")
      }
    >
      {/* One real button spans the card so it's keyboard-reachable; the visible
          content sits above it but lets clicks fall through. */}
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        aria-label={`Open ${name}'s profile`}
        className="absolute inset-0 cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand"
      />

      <span className="pointer-events-none relative">
        <Avatar member={member} size={48} />
      </span>
      <span className="pointer-events-none relative min-w-0">
        <span className="block truncate text-sm font-semibold text-ctp-text">{name}</span>
        {member?.nameZh && <span className="block truncate text-xs text-ctp-subtext0">{member.nameZh}</span>}
        {year !== null && (
          <span className="mt-0.5 block text-[11px] font-medium text-ctp-overlay1">b. {year}</span>
        )}
      </span>

      {!isRoot && (
        <button
          type="button"
          onClick={() => onFocusTree(node.id)}
          aria-label={`View the tree from ${name}`}
          title={`View the tree from ${name}`}
          className="absolute -top-2 -right-2 z-10 flex size-7 cursor-pointer items-center justify-center rounded-full
                     border border-ctp-surface1 bg-ctp-mantle text-ctp-subtext1 opacity-0 shadow-sm transition
                     group-hover:opacity-100 hover:text-brand focus-visible:opacity-100 pointer-coarse:opacity-100"
        >
          <Icon name="tree" className="size-3.5" />
        </button>
      )}
    </div>
  );
}
