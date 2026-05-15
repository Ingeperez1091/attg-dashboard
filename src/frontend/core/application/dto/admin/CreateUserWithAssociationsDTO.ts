import { RoleName } from "@/core/domain/entities/Role";

export interface CreateUserWithAssociationsDTO {
  username: string;
  email: string;
  displayName?: string;
  azureAdObjectId?: string;
  isActive: boolean;
  roleId?: RoleName;
  applicationIds?: string[];
  actorUserId: string;
}
