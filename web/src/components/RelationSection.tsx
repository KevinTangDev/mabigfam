import { useNavigate } from "react-router-dom";
import Avatar from "./Avatar";
import Icon from "./icons";
import { Button, Chip, cardClass, inputClass } from "./ui";
import type { FamilyMember } from "../types";

export interface RelationEntry {
  /** The related person. */
  member: FamilyMember;
  /** Optional label shown beside the name, e.g. a partnership status. */
  badge?: string;
}

interface Props {
  heading: string;
  entries: RelationEntry[];
  pickable: FamilyMember[];
  placeholder: string;
  emptyText: string;
  value: string;
  onValueChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (memberId: string) => void;
  /** Extra control rendered next to the picker, e.g. a status select. */
  extraControl?: React.ReactNode;
}

export default function RelationSection({
  heading,
  entries,
  pickable,
  placeholder,
  emptyText,
  value,
  onValueChange,
  onAdd,
  onRemove,
  extraControl,
}: Props) {
  const navigate = useNavigate();

  return (
    <section className={`${cardClass} p-4 sm:p-5`}>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-ctp-text">{heading}</h3>
        {entries.length > 0 && <Chip>{entries.length}</Chip>}
      </div>

      <ul className="-mx-2 mt-2">
        {entries.map(({ member, badge }) => (
          <li
            key={member.id}
            className="group flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-ctp-surface0/50"
          >
            <Avatar member={member} size={36} />
            <button
              onClick={() => navigate(`/members/${member.id}`)}
              className="min-w-0 cursor-pointer truncate text-left text-sm font-semibold text-ctp-text hover:text-brand"
            >
              {member.name}
            </button>
            {badge && <Chip tone="pink">{badge}</Chip>}
            <Button
              variant="danger"
              onClick={() => onRemove(member.id)}
              className="ml-auto px-2.5 py-1 text-xs opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
            >
              Remove
            </Button>
          </li>
        ))}
        {entries.length === 0 && <li className="px-2 py-2 text-sm text-ctp-subtext0">{emptyText}</li>}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-ctp-surface0 pt-3">
        <select
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        >
          <option value="">{placeholder}</option>
          {pickable.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {extraControl}
        <Button onClick={onAdd} disabled={!value}>
          <Icon name="plus" />
          Add
        </Button>
      </div>
    </section>
  );
}
