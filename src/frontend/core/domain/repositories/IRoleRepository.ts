import { Role, RoleName } from "@/core/domain/entities/Role";

export interface IRoleRepository {
  listRoles(): Promise<Role[]>;
  getRoleByUserId(userId: string): Promise<RoleName | null>;
  assignRole(userId: string, role: RoleName, actorUserId: string): Promise<void>;
  countActiveByRole(role: RoleName): Promise<number>;
}
