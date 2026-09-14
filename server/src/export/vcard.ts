import type { FamilyMember } from "@prisma/client";
import { escapeText, serializeLines } from "./fold.js";

export interface PhotoData {
  base64: string;
  /** vCard 3.0 TYPE token, e.g. JPEG / PNG / WEBP. */
  type: string;
}

/**
 * vCard 3.0 rather than 4.0: both iOS and Android import 3.0 reliably, while
 * 4.0 support is patchier in stock contacts apps.
 */
export function memberToVCard(member: FamilyMember, photo?: PhotoData | null): string {
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];

  // N is structured (family;given;middle;prefix;suffix). We only store a
  // single display name, so it goes in the given-name slot and FN carries
  // the full string — which is what clients actually display.
  lines.push(`N:;${escapeText(member.name)};;;`);
  lines.push(`FN:${escapeText(member.name)}`);

  // The Chinese name is a real name, not a pet name, but vCard 3.0 has no
  // second-script field. NICKNAME is the closest thing that stock contacts
  // apps both display and search.
  if (member.nameZh) {
    lines.push(`NICKNAME:${escapeText(member.nameZh)}`);
  }

  if (member.phone) {
    lines.push(`TEL;TYPE=CELL,VOICE:${escapeText(member.phone)}`);
  }

  if (member.address) {
    // ADR is structured (po;ext;street;locality;region;postal;country). We
    // hold one freeform string, so it all goes in the street component.
    lines.push(`ADR;TYPE=HOME:;;${escapeText(member.address)};;;;`);
  }

  if (member.birthday) {
    lines.push(`BDAY:${member.birthday.toISOString().slice(0, 10)}`);
  }

  if (member.note) {
    lines.push(`NOTE:${escapeText(member.note)}`);
  }

  if (photo) {
    lines.push(`PHOTO;ENCODING=b;TYPE=${photo.type}:${photo.base64}`);
  }

  // A stable UID lets a re-import update the existing contact instead of
  // creating a duplicate.
  lines.push(`UID:mabigfam-${member.id}`);
  lines.push(`REV:${member.updatedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`);
  lines.push("END:VCARD");

  return serializeLines(lines);
}

export function membersToVCards(
  members: FamilyMember[],
  photos: Map<string, PhotoData>,
): string {
  return members.map((m) => memberToVCard(m, photos.get(m.id))).join("");
}

/** image/jpeg -> JPEG, for the vCard TYPE parameter. */
export function mimeToVCardType(mime: string): string {
  return (mime.split("/")[1] ?? "JPEG").toUpperCase();
}
