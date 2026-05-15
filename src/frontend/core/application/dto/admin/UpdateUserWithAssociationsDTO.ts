import { RoleName } from "@/core/domain/entities/Role";

export interface UpdateUserWithAssociationsDTO {
  userId: string;
  isActive: boolean;
  roleId: RoleName;
  applicationIds: string[];
  actorUserId: string;
}
