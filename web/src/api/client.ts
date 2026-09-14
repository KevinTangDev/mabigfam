import type { FamilyMember, FamilyMemberInput, MemberRelations, ParentChildLink, TreeData } from "../types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listMembers: (search?: string) =>
    request<FamilyMember[]>(`/members${search ? `?search=${encodeURIComponent(search)}` : ""}`),

  getMember: (id: string) => request<FamilyMember>(`/members/${id}`),

  getMemberRelations: (id: string) => request<MemberRelations>(`/members/${id}/relations`),

  createMember: (data: FamilyMemberInput) =>
    request<FamilyMember>("/members", { method: "POST", body: JSON.stringify(data) }),

  updateMember: (id: string, data: Partial<FamilyMemberInput>) =>
    request<FamilyMember>(`/members/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteMember: (id: string) => request<void>(`/members/${id}`, { method: "DELETE" }),

  listLinks: () => request<ParentChildLink[]>("/links"),

  createLink: (parentId: string, childId: string) =>
    request<ParentChildLink>("/links", { method: "POST", body: JSON.stringify({ parentId, childId }) }),

  deleteLink: (id: string) => request<void>(`/links/${id}`, { method: "DELETE" }),

  getTree: () => request<TreeData>("/tree"),
};
