export type AccessProfile = "INTERVIEWER" | "REFERRAL_OPERATOR" | "DIRECTION";
export type UserStatus = "ACTIVE" | "INACTIVE";
export interface ReferenceItem { id: string; name: string; active: boolean; code?: string }
export interface SafeUser {
  id: string; name: string; email: string; registrationNumber: string;
  functionalIdentifier: string | null; accessProfile: AccessProfile;
  professionalCategoryId: string; primaryUnitId: string; status: UserStatus;
  mustChangePassword: boolean; createdAt: string | Date; updatedAt: string | Date;
  lastLoginAt: string | Date | null;
  professionalCategory: { id: string; name: string };
  primaryUnit: { id: string; name: string; code: string };
}
export interface UserInput {
  name: string; email: string; registrationNumber: string; functionalIdentifier?: string | null;
  accessProfile: AccessProfile; professionalCategoryId: string; primaryUnitId: string; status: UserStatus;
}
export interface AuditEntry {
  id: string; action: string; entityType: string; entityId: string | null;
  createdAt: string | Date; actorUser?: { name: string; email?: string } | null;
  previousValue?: unknown; newValue?: unknown; metadata?: unknown;
}
export const profileLabels: Record<AccessProfile, string> = {
  INTERVIEWER: "Entrevistador", REFERRAL_OPERATOR: "Encaminhador", DIRECTION: "Direção",
};
export const statusLabels: Record<UserStatus, string> = { ACTIVE: "Ativo", INACTIVE: "Inativo" };
