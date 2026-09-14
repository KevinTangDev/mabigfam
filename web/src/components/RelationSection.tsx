import { useNavigate } from "react-router-dom";
import Avatar from "./Avatar";
import { Button, cardClass, inputClass } from "./ui";
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
    <section className={`${cardClass} p-4`}>
      <h3 className="text-sm font-semibold text-ctp-text">{heading}</h3>

      <ul className="mt-2 divide-y divide-ctp-surface0">
        {entries.map(({ member, badge }) => (
          <li key={member.id} className="group flex items-center gap-3 py-2">
            <Avatar member={member} size={30} />
            <button
              onClick={() => navigate(`/members/${member.id}`)}
              className="cursor-pointer text-sm font-medium text-ctp-blue hover:underline"
            >
              {member.name}
            </button>
            {badge && (
              <span className="rounded-full bg-ctp-surface0 px-2 py-0.5 text-xs text-ctp-subtext0">
                {badge}
              </span>
            )}
            <Button
              variant="danger"
              onClick={() => onRemove(member.id)}
              className="ml-auto opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
            >
              Remove
            </Button>
          </li>
        ))}
        {entries.length === 0 && <li className="py-2 text-sm text-ctp-subtext0">{emptyText}</li>}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
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
          Add
        </Button>
      </div>
    </section>
  );
}
