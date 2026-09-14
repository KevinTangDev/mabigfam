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
  "bg-ctp-blue/20 text-ctp-blue",
  "bg-ctp-mauve/20 text-ctp-mauve",
  "bg-ctp-pink/20 text-ctp-pink",
  "bg-ctp-peach/20 text-ctp-peach",
  "bg-ctp-green/20 text-ctp-green",
  "bg-ctp-teal/20 text-ctp-teal",
  "bg-ctp-sapphire/20 text-ctp-sapphire",
  "bg-ctp-lavender/20 text-ctp-lavender",
  "bg-ctp-flamingo/20 text-ctp-flamingo",
  "bg-ctp-maroon/20 text-ctp-maroon",
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
        className="shrink-0 rounded-full border border-ctp-surface1 bg-ctp-surface0 object-cover"
      />
    );
  }

  const name = member?.name ?? "?";
  return (
    <span
      aria-hidden="true"
      style={{ ...style, fontSize: Math.max(10, size * 0.36) }}
      className={
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold " +
        (member ? accentFor(name) : "bg-ctp-surface0 text-ctp-overlay1")
      }
    >
      {member ? initials(name) : "?"}
    </span>
  );
}
