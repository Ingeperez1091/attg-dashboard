import { Role, RoleName } from "@/core/domain/entities/Role";
import { IRoleRepository } from "@/core/domain/repositories/IRoleRepository";
import { SqlClient } from "@/lib/db/sql-client";
import {
  getRoleNameByUserIdQuery,
  assignRoleQuery,
  countActiveUsersByRoleQuery
} from "./queries/role-queries";

export class RoleDbRepository implements IRoleRepository {
  constructor(private readonly sqlClient: SqlClient) {}

  async getRoleNameByUserId(userId: string): Promise<RoleName | null> {
    return this.getRoleByUserId(userId);
  }

  async listRoles(): Promise<Role[]> {
    const sql = `
      SELECT RoleName, IsActive
      FROM app.Roles
      WHERE IsActive = 1
      ORDER BY RoleName
    `;
    const result = await this.sqlClient.query<{
      RoleName: string;
      IsActive: number;
    }>(sql, {});

    return result.rows.flatMap((row) => {
      const roleId = this.mapDbRoleToRoleName(row.RoleName);

      if (!roleId) {
        return [];
      }

      return [{
        roleId,
        roleName: row.RoleName,
        isActive: row.IsActive === 1
      }];
    });
  }

  private mapDbRoleToRoleName(roleName: string): RoleName | null {
    const normalized = roleName.trim().toLowerCase().replace(/[\s-]+/g, "_");
    return normalized as RoleName;
    if (normalized === "administrator") {
      return "administrator";
    }

    if (normalized === "application_owner") {
      return "application_owner";
    }

    if (normalized === "viewer") {
      return "viewer";
    }

    return null;
  }

  async getRoleByUserId(userId: string): Promise<RoleName | null> {
    return getRoleNameByUserIdQuery(this.sqlClient, userId);
  }

  async assignRole(userId: string, role: RoleName, actorUserId: string): Promise<void> {
    return assignRoleQuery(this.sqlClient, userId, role, actorUserId);
  }

  async countActiveByRole(role: RoleName): Promise<number> {
    return countActiveUsersByRoleQuery(this.sqlClient, role);
  }
}

