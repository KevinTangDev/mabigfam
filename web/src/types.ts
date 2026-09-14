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

export interface MemberRelations extends FamilyMember {
  parents: FamilyMember[];
  children: FamilyMember[];
}

export interface TreeData {
  members: FamilyMember[];
  links: ParentChildLink[];
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
