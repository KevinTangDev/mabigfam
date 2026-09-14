import { photoUrl } from "../api/client";
import type { FamilyMember } from "../types";

interface Props {
  member: Pick<FamilyMember, "name" | "photoPath"> | undefined;
  size: number;
}

/** First letter of the first two words, e.g. "Ah Gong" -> "AG". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** Stable per-person colour so the fallback isn't a sea of identical grey. */
function hueFor(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return hash;
}

export default function Avatar({ member, size }: Props) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };

  if (member?.photoPath) {
    return (
      <img
        className="avatar"
        style={style}
        src={photoUrl(member.photoPath)}
        alt={member.name}
        loading="lazy"
      />
    );
  }

  const name = member?.name ?? "?";
  return (
    <span
      className="avatar avatar--fallback"
      style={{ ...style, background: `hsl(${hueFor(name)} 55% 88%)`, color: `hsl(${hueFor(name)} 45% 30%)` }}
      aria-hidden="true"
    >
      {member ? initials(name) : "?"}
    </span>
  );
}
