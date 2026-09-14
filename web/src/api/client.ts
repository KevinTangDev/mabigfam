import type {
  FamilyEvent,
  FamilyEventInput,
  FamilyMember,
  FamilyMemberInput,
  MemberRelations,
  ParentChildLink,
  Partnership,
  PartnershipStatus,
  TreeData,
} from "../types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Called when the API reports we're no longer signed in (expired or cleared
 * session), so the app can drop back to the login screen instead of showing
 * a wall of failed requests. Registered by AuthProvider.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function handle<T>(res: Response, isLoginRequest: boolean): Promise<T> {
  if (res.status === 401 && !isLoginRequest) {
    onUnauthorized?.();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: unknown });
    const message =
      typeof body.error === "string"
        ? body.error
        : body.error
          ? JSON.stringify(body.error)
          : `Request failed: ${res.status}`;
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Only declare a JSON content type when we're actually sending JSON.
  // Fastify rejects a bodyless request that claims application/json with
  // FST_ERR_CTP_EMPTY_JSON_BODY (400), which silently broke every DELETE
  // and the bodyless logout POST.
  const headers = init?.body ? { "Content-Type": "application/json" } : undefined;

  const res = await fetch(`/api${path}`, { ...init, headers });
  return handle<T>(res, path.startsWith("/auth/login"));
}

/** Multipart variant: the browser must set Content-Type itself (boundary). */
async function upload<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`/api${path}`, { method: "POST", body });
  return handle<T>(res, false);
}

/** URL for a stored photo. `photoPath` is the opaque key from the API. */
export function photoUrl(photoPath: string): string {
  return `/api/photos/${photoPath}`;
}

/**
 * Downloads an authenticated endpoint as a file.
 *
 * Fetched rather than linked to with <a download> so a 401 surfaces through
 * the normal error path (and bounces to the login screen) instead of dumping
 * raw JSON into a new tab.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`/api${path}`);

  // Deliberately not routed through handle(): that parses the body as JSON,
  // which would consume it before it can be read as a blob.
  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    const body = await res.json().catch(() => ({}) as { error?: unknown });
    const message =
      typeof body.error === "string" ? body.error : `Download failed: ${res.status}`;
    throw new ApiError(message, res.status);
  }

  const blob = await res.blob();

  // Prefer the server's filename when it sent one.
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = match?.[1] ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  // --- auth ---
  getSession: () => request<{ authenticated: boolean }>("/auth/session"),

  login: (password: string) =>
    request<{ authenticated: boolean }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  logout: () => request<{ authenticated: boolean }>("/auth/logout", { method: "POST" }),

  // --- members ---
  listMembers: (search?: string) =>
    request<FamilyMember[]>(`/members${search ? `?search=${encodeURIComponent(search)}` : ""}`),

  getMember: (id: string) => request<FamilyMember>(`/members/${id}`),

  getMemberRelations: (id: string) => request<MemberRelations>(`/members/${id}/relations`),

  createMember: (data: FamilyMemberInput) =>
    request<FamilyMember>("/members", { method: "POST", body: JSON.stringify(data) }),

  updateMember: (id: string, data: Partial<FamilyMemberInput>) =>
    request<FamilyMember>(`/members/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteMember: (id: string) => request<void>(`/members/${id}`, { method: "DELETE" }),

  // --- photos ---
  uploadPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append("photo", file);
    return upload<FamilyMember>(`/members/${id}/photo`, form);
  },

  deletePhoto: (id: string) => request<FamilyMember>(`/members/${id}/photo`, { method: "DELETE" }),

  // --- links ---
  listLinks: () => request<ParentChildLink[]>("/links"),

  createLink: (parentId: string, childId: string) =>
    request<ParentChildLink>("/links", { method: "POST", body: JSON.stringify({ parentId, childId }) }),

  deleteLink: (id: string) => request<void>(`/links/${id}`, { method: "DELETE" }),

  getTree: () => request<TreeData>("/tree"),

  // --- partnerships ---
  listPartnerships: () => request<Partnership[]>("/partnerships"),

  createPartnership: (memberIds: [string, string], status: PartnershipStatus) =>
    request<Partnership>("/partnerships", {
      method: "POST",
      body: JSON.stringify({ memberIds, status }),
    }),

  updatePartnership: (id: string, data: { status?: PartnershipStatus; since?: string | null }) =>
    request<Partnership>(`/partnerships/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deletePartnership: (id: string) =>
    request<void>(`/partnerships/${id}`, { method: "DELETE" }),

  // --- events / calendar ---
  listEvents: () => request<FamilyEvent[]>("/events"),

  createEvent: (data: FamilyEventInput) =>
    request<FamilyEvent>("/events", { method: "POST", body: JSON.stringify(data) }),

  updateEvent: (id: string, data: Partial<FamilyEventInput>) =>
    request<FamilyEvent>(`/events/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteEvent: (id: string) => request<void>(`/events/${id}`, { method: "DELETE" }),

  getCalendarSubscription: () => request<{ path: string }>("/calendar/subscription"),
};
