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
