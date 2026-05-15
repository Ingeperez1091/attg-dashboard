import { executeParameterizedQuery, SqlClient } from "@/lib/db/sql-client";
import { ApplicationAssignmentDbRow } from "@/lib/db/types";

/**
 * Lists application ids assigned to the given user.
 */
export async function listApplicationsByUserIdQuery(client: SqlClient, userId: string): Promise<string[]> {
  const result = await executeParameterizedQuery<ApplicationAssignmentDbRow>(
    client,
    `SELECT ApplicationId
     FROM app.UserApplications
     WHERE UserId = @userId`,
    { userId }
  );

  return result.rows.map((row) => row.ApplicationId);
}

/**
 * Assigns a single application to a user with idempotent MERGE behavior.
 */
export async function assignApplicationQuery(
  client: SqlClient,
  userId: string,
  applicationId: string,
  actorUserId: string
): Promise<void> {
  await executeParameterizedQuery(
    client,
    `MERGE app.UserApplications AS target
     USING (SELECT @userId AS UserId, @applicationId AS ApplicationId) AS source
       ON target.UserId = source.UserId AND target.ApplicationId = source.ApplicationId
     WHEN NOT MATCHED THEN
       INSERT (UserApplicationId, UserId, ApplicationId, AssignedDate, AssignedBy, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
       VALUES (NEWID(), source.UserId, source.ApplicationId, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId);`,
    {
      userId,
      applicationId,
      actorUserId
    }
  );
}

/**
 * Assigns all active applications plus wildcard marker to the user.
 */
export async function assignAllApplicationsQuery(client: SqlClient, userId: string, actorUserId: string): Promise<void> {
  await executeParameterizedQuery(
    client,
    `WITH sourceRows AS (
       SELECT @userId AS UserId, CAST(a.ApplicationId AS NVARCHAR(100)) AS ApplicationId
       FROM app.Applications a
       WHERE a.IsActive = 1
       UNION ALL
       SELECT @userId AS UserId, N'*' AS ApplicationId
     )
     MERGE app.UserApplications AS target
     USING sourceRows AS source
       ON target.UserId = source.UserId AND target.ApplicationId = source.ApplicationId
     WHEN NOT MATCHED THEN
       INSERT (UserApplicationId, UserId, ApplicationId, AssignedDate, AssignedBy, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
       VALUES (NEWID(), source.UserId, source.ApplicationId, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId);`,
    {
      userId,
      actorUserId
    }
  );
}

/**
 * Removes a specific user-application assignment.
 */
export async function unassignApplicationQuery(client: SqlClient, userId: string, applicationId: string): Promise<boolean> {
  const result = await executeParameterizedQuery(
    client,
    `DELETE FROM app.UserApplications
     OUTPUT deleted.UserApplicationId
     WHERE UserId = @userId AND ApplicationId = @applicationId`,
    {
      userId,
      applicationId
    }
  );

  return result.rows.length > 0;
}
