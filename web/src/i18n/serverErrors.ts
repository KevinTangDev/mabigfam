import type { BaseKey, TFn } from "./config";

/**
 * The API replies in English. These are the messages it can send that a person
 * would actually see; each is matched exactly (they're fixed strings in
 * server/src) and shown in the active language instead. Anything unrecognised
 * — e.g. a validation detail — is passed through untouched.
 */
const EXACT: Record<string, BaseKey> = {
  "Incorrect password": "server.incorrectPassword",
  "Password is required": "server.passwordRequired",
  "Not authenticated": "server.notAuthenticated",
  "Not found": "server.notFound",
  "Family member not found": "server.memberNotFound",
  "Event not found": "server.eventNotFound",
  "Link not found": "server.linkNotFound",
  "Partnership not found": "server.partnershipNotFound",
  "Trashed member not found": "server.trashedNotFound",
  "One or both members not found": "server.bothNotFound",
  "Parent or child member not found": "server.parentChildNotFound",
  "A member cannot be their own parent": "server.ownParent",
  "A member cannot be their own partner": "server.ownPartner",
  "This link would create a cycle in the family tree": "server.cycle",
  "This parent/child link already exists": "server.linkExists",
  "Those two are already linked as parent and child": "server.alreadyLinked",
  "These two are already partners": "server.alreadyPartners",
  "The end must be after the start": "server.endBeforeStart",
  "No photo uploaded": "server.noPhoto",
  "Invalid JSON body": "server.invalidJson",
  "Unsupported image type. Please upload a JPEG, PNG or WebP file.": "server.unsupportedImage",
  "HEIC images aren't supported. Convert it to JPEG first, or set your iPhone camera to Settings > Camera > Formats > Most Compatible.":
    "server.heic",
};

export function translateServerMessage(message: string, t: TFn): string | null {
  const exact = EXACT[message];
  if (exact) return t(exact);

  const tooLarge = /^Photo is too large \(limit (\d+)MB\)$/.exec(message);
  if (tooLarge) return t("server.photoTooLarge", { limit: tooLarge[1]! });

  if (/^Could not process that image/.test(message)) return t("server.imageProcess");
  if (/^Rate limit exceeded/i.test(message)) return t("error.tooManyAttempts");

  const failed = /^Request failed: (\d+)$/.exec(message);
  if (failed) return t("error.requestFailed", { status: failed[1]! });
  if (/^Download failed/.test(message)) return t("error.downloadFailed");

  // fetch() rejects with a bare TypeError when the server is unreachable.
  if (/^(Failed to fetch|Load failed|NetworkError)/i.test(message)) return t("error.network");

  return null;
}
