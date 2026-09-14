export interface FamilyMember {
  id: string;
  name: string;
  nameZh: string | null;
  birthday: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  photoPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FamilyMemberInput = {
  name: string;
  nameZh?: string | null;
  birthday?: string | null;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
  photoPath?: string | null;
};

export interface ParentChildLink {
  id: string;
  parentId: string;
  childId: string;
  createdAt: string;
}

export type PartnershipStatus = "married" | "partner" | "divorced";

export interface Partnership {
  id: string;
  aId: string;
  bId: string;
  status: PartnershipStatus;
  since: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A partner as returned by the relations endpoint, with the link's metadata. */
export interface ResolvedPartner {
  partnershipId: string;
  status: PartnershipStatus;
  since: string | null;
  member: FamilyMember;
}

export interface MemberRelations extends FamilyMember {
  parents: FamilyMember[];
  children: FamilyMember[];
  partners: ResolvedPartner[];
}

export interface TreeData {
  members: FamilyMember[];
  links: ParentChildLink[];
  partnerships: Partnership[];
}

export interface FamilyEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FamilyEventInput = {
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt?: string | null;
  allDay?: boolean;
};
