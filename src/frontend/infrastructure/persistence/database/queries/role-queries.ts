import { executeParameterizedQuery, SqlClient } from "@/lib/db/sql-client";
import { ActiveCountDbRow, RoleNameDbRow } from "@/lib/db/types";
import { RoleName } from "@/core/domain/entities/Role";

/**
 * Resolves the effective role name for a user.
 */
export async function getRoleNameByUserIdQuery(client: SqlClient, userId: string): Promise<RoleName | null> {
  const result = await executeParameterizedQuery<RoleNameDbRow>(
    client,
    `SELECT r.RoleName
     FROM app.UserRoles ur
     INNER JOIN app.Roles r ON r.RoleId = ur.RoleId
     WHERE ur.UserId = @userId`,
    { userId }
  );

  return result.rows[0]?.RoleName ?? null;
}

/**
 * Upserts a role assignment for the target user using MERGE semantics.
 */
export async function assignRoleQuery(
  client: SqlClient,
  userId: string,
  role: RoleName,
  actorUserId: string
): Promise<void> {
  await executeParameterizedQuery(
    client,
    `MERGE app.UserRoles AS target
     USING (
       SELECT @userId AS UserId, r.RoleId AS RoleId
       FROM app.Roles r
       WHERE r.RoleName = @roleName
     ) AS source
       ON target.UserId = source.UserId
     WHEN MATCHED THEN
       UPDATE SET target.RoleId = source.RoleId,
                  target.UpdateDate = SYSUTCDATETIME(),
                  target.UpdatedBy = @actorUserId,
                  target.AssignedDate = SYSUTCDATETIME(),
                  target.AssignedBy = @actorUserId
     WHEN NOT MATCHED THEN
       INSERT (UserRoleId, UserId, RoleId, AssignedDate, AssignedBy, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
       VALUES (NEWID(), source.UserId, source.RoleId, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId);`,
    {
      userId,
      roleName: role,
      actorUserId
    }
  );
}

/**
 * Counts active users currently assigned to the provided role.
 */
export async function countActiveUsersByRoleQuery(client: SqlClient, role: RoleName): Promise<number> {
  const result = await executeParameterizedQuery<ActiveCountDbRow>(
    client,
    `SELECT COUNT_BIG(1) AS ActiveCount
     FROM app.UserRoles ur
     INNER JOIN app.Roles r ON r.RoleId = ur.RoleId
     INNER JOIN app.Users u ON u.UserId = ur.UserId
     WHERE r.RoleName = @roleName
       AND u.IsActive = 1`,
    {
      roleName: role
    }
  );

  return Number(result.rows[0]?.ActiveCount ?? 0);
}
