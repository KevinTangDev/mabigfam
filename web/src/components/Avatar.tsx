import { photoUrl } from "../api/client";
import type { FamilyMember } from "../types";

interface Props {
  member: Pick<FamilyMember, "name" | "photoPath"> | undefined;
  size: number;
}

/**
 * Fallback tints, one per Catppuccin accent. Written as literal class strings
 * so Tailwind's scanner picks them up (a template-built class name would be
 * invisible to it and get purged).
 */
const ACCENTS = [
  "bg-linear-to-br from-ctp-blue/35 to-ctp-blue/10 text-ctp-blue",
  "bg-linear-to-br from-ctp-mauve/35 to-ctp-mauve/10 text-ctp-mauve",
  "bg-linear-to-br from-ctp-pink/35 to-ctp-pink/10 text-ctp-pink",
  "bg-linear-to-br from-ctp-peach/35 to-ctp-peach/10 text-ctp-peach",
  "bg-linear-to-br from-ctp-green/35 to-ctp-green/10 text-ctp-green",
  "bg-linear-to-br from-ctp-teal/35 to-ctp-teal/10 text-ctp-teal",
  "bg-linear-to-br from-ctp-sapphire/35 to-ctp-sapphire/10 text-ctp-sapphire",
  "bg-linear-to-br from-ctp-lavender/35 to-ctp-lavender/10 text-ctp-lavender",
  "bg-linear-to-br from-ctp-flamingo/35 to-ctp-flamingo/10 text-ctp-flamingo",
  "bg-linear-to-br from-ctp-maroon/35 to-ctp-maroon/10 text-ctp-maroon",
];

/** First letter of the first two words, e.g. "Ah Gong" -> "AG". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** Stable per-person accent, so someone's colour never changes between views. */
function accentFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 9973;
  }
  return ACCENTS[hash % ACCENTS.length]!;
}

export default function Avatar({ member, size }: Props) {
  const style = { width: size, height: size };

  if (member?.photoPath) {
    return (
      <img
        src={photoUrl(member.photoPath)}
        alt={member.name}
        loading="lazy"
        style={style}
        className="shrink-0 rounded-full bg-ctp-surface0 object-cover ring-2 ring-ctp-mantle"
      />
    );
  }

  const name = member?.name ?? "?";
  return (
    <span
      aria-hidden="true"
      style={{ ...style, fontSize: Math.max(10, size * 0.36) }}
      className={
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ring-2 ring-ctp-mantle " +
        (member ? accentFor(name) : "bg-ctp-surface0 text-ctp-overlay1")
      }
    >
      {member ? initials(name) : "?"}
    </span>
  );
}
