import { executeParameterizedQuery, SqlClient } from "@/lib/db/sql-client";
import { UserDbRow } from "@/lib/db/types";
import { CreateUserDTO } from "@/core/application/dto/admin/CreateUserDTO";
import { UserEntity } from "@/core/domain/entities/UserEntity";

function mapRow(row: UserDbRow): UserEntity {
  return {
    userId: row.UserId,
    username: row.Username,
    email: row.Email,
    displayName: row.DisplayName,
    azureAdObjectId: row.AzureADObjectId,
    isActive: row.IsActive,
    createDate: row.CreateDate,
    createdBy: row.CreatedBy,
    updateDate: row.UpdateDate,
    updatedBy: row.UpdatedBy
  };
}

/**
 * Retrieves a single user record by UserId.
 */
export async function getUserByIdQuery(client: SqlClient, userId: string): Promise<UserEntity | null> {
  const result = await executeParameterizedQuery<UserDbRow>(
    client,
    `SELECT UserId, Username, Email, DisplayName, AzureADObjectId, IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy
     FROM app.Users
     WHERE UserId = @userId`,
    { userId }
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

/**
 * Retrieves a single user record by Azure AD object id.
 */
export async function getUserByAzureAdObjectIdQuery(client: SqlClient, azureAdObjectId: string): Promise<UserEntity | null> {
  const result = await executeParameterizedQuery<UserDbRow>(
    client,
    `SELECT UserId, Username, Email, DisplayName, AzureADObjectId, IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy
     FROM app.Users
     WHERE AzureADObjectId = @azureAdObjectId`,
    { azureAdObjectId }
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

/**
 * Lists users with optional inactive records included.
 */
export async function listUsersQuery(client: SqlClient, includeInactive = false): Promise<UserEntity[]> {
  const result = await executeParameterizedQuery<UserDbRow>(
    client,
    `SELECT UserId, Username, Email, DisplayName, AzureADObjectId, IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy
     FROM app.Users
     WHERE (@includeInactive = 1 OR IsActive = 1)
     ORDER BY CreateDate DESC`,
    { includeInactive: includeInactive ? 1 : 0 }
  );

  return result.rows.map(mapRow);
}

/**
 * Inserts a new user and returns the created record.
 */
export async function createUserQuery(client: SqlClient, input: CreateUserDTO): Promise<UserEntity> {
  const result = await executeParameterizedQuery<UserDbRow>(
    client,
    `DECLARE @newUserId UNIQUEIDENTIFIER = NEWID();

     INSERT INTO app.Users (UserId, Username, Email, DisplayName, AzureADObjectId, IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
     VALUES (@newUserId, @username, @email, @displayName, @azureAdObjectId, @isActive, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId);

     SELECT UserId, Username, Email, DisplayName, AzureADObjectId, IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy
     FROM app.Users
     WHERE UserId = @newUserId;`,
    {
      username: input.username,
      email: input.email,
      displayName: input.displayName ?? null,
      azureAdObjectId: input.azureAdObjectId ?? null,
      isActive: input.isActive ? 1 : 0,
      actorUserId: input.actorUserId
    }
  );

  return mapRow(result.rows[0]);
}

/**
 * Inserts a user and optional associations atomically in a single SQL transaction.
 * Role and application links are upserted via MERGE to keep assignment idempotent.
 */
export async function createUserWithAssociationsQuery(
  client: SqlClient,
  input: CreateUserDTO,
  options: { roleId?: string; applicationIds?: string[] }
): Promise<UserEntity> {
  const applicationIdsJson = JSON.stringify(options.applicationIds ?? []);
  const roleName = options.roleId ?? null;

  const result = await executeParameterizedQuery<UserDbRow>(
    client,
    `BEGIN TRY
       BEGIN TRAN;

       DECLARE @created TABLE
       (
         UserId UNIQUEIDENTIFIER,
         Username NVARCHAR(255),
         Email NVARCHAR(320),
         DisplayName NVARCHAR(255),
         AzureADObjectId NVARCHAR(255),
         IsActive BIT,
         CreateDate DATETIME2,
         CreatedBy NVARCHAR(255),
         UpdateDate DATETIME2,
         UpdatedBy NVARCHAR(255)
       );

       INSERT INTO app.Users (UserId, Username, Email, DisplayName, AzureADObjectId, IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
       OUTPUT inserted.UserId, inserted.Username, inserted.Email, inserted.DisplayName, inserted.AzureADObjectId, inserted.IsActive, inserted.CreateDate, inserted.CreatedBy, inserted.UpdateDate, inserted.UpdatedBy
       INTO @created
       VALUES (NEWID(), @username, @email, @displayName, @azureAdObjectId, @isActive, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId);

       IF (@roleName IS NOT NULL AND @roleName <> N'viewer')
       BEGIN
         MERGE app.UserRoles AS target
         USING (
           SELECT c.UserId, r.RoleId
           FROM @created c
           INNER JOIN app.Roles r ON r.RoleName = @roleName
         ) AS source
           ON target.UserId = source.UserId
         WHEN MATCHED THEN
           UPDATE SET target.RoleId = source.RoleId,
                      target.AssignedDate = SYSUTCDATETIME(),
                      target.AssignedBy = @actorUserId,
                      target.UpdateDate = SYSUTCDATETIME(),
                      target.UpdatedBy = @actorUserId
         WHEN NOT MATCHED THEN
           INSERT (UserRoleId, UserId, RoleId, AssignedDate, AssignedBy, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
           VALUES (NEWID(), source.UserId, source.RoleId, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId);
       END;

       IF (ISJSON(@applicationIdsJson) = 1)
       BEGIN
         MERGE app.UserApplications AS target
         USING (
           SELECT c.UserId, TRY_CONVERT(UNIQUEIDENTIFIER, j.[value]) AS ApplicationId
           FROM @created c
           CROSS APPLY OPENJSON(@applicationIdsJson) j
           WHERE TRY_CONVERT(UNIQUEIDENTIFIER, j.[value]) IS NOT NULL
         ) AS source
           ON target.UserId = source.UserId AND target.ApplicationId = source.ApplicationId
         WHEN NOT MATCHED THEN
           INSERT (UserApplicationId, UserId, ApplicationId, AssignedDate, AssignedBy, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
           VALUES (NEWID(), source.UserId, source.ApplicationId, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId);
       END;

       SELECT UserId, Username, Email, DisplayName, AzureADObjectId, IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy
       FROM @created;

       COMMIT;
     END TRY
     BEGIN CATCH
       IF (@@TRANCOUNT > 0)
         ROLLBACK;
       THROW;
     END CATCH;`,
    {
      username: input.username,
      email: input.email,
      displayName: input.displayName ?? null,
      azureAdObjectId: input.azureAdObjectId ?? null,
      isActive: input.isActive ? 1 : 0,
      actorUserId: input.actorUserId,
      roleName,
      applicationIdsJson
    }
  );

  return mapRow(result.rows[0]);
}

/**
 * Updates a user's active flag and returns the updated record.
 */
export async function updateUserIsActiveQuery(
  client: SqlClient,
  userId: string,
  isActive: boolean,
  actorUserId: string
): Promise<UserEntity | null> {
  const result = await executeParameterizedQuery<UserDbRow>(
    client,
    `UPDATE app.Users
     SET IsActive = @isActive,
         UpdateDate = SYSUTCDATETIME(),
         UpdatedBy = @actorUserId
     WHERE UserId = @userId;

     SELECT UserId, Username, Email, DisplayName, AzureADObjectId, IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy
     FROM app.Users
     WHERE UserId = @userId;`,
    {
      userId,
      isActive: isActive ? 1 : 0,
      actorUserId
    }
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

/**
 * Binds Azure AD object id on first successful SSO login.
 * Existing bindings are preserved and never overwritten.
 */
export async function bindUserAzureAdObjectIdQuery(
  client: SqlClient,
  userId: string,
  azureAdObjectId: string,
  actorUserId: string
): Promise<UserEntity | null> {
  const result = await executeParameterizedQuery<UserDbRow>(
    client,
    `UPDATE app.Users
     SET AzureADObjectId = @azureAdObjectId,
         UpdateDate = SYSUTCDATETIME(),
         UpdatedBy = @actorUserId
     WHERE UserId = @userId
       AND (AzureADObjectId IS NULL OR AzureADObjectId = '');

     SELECT UserId, Username, Email, DisplayName, AzureADObjectId, IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy
     FROM app.Users
     WHERE UserId = @userId;`,
    {
      userId,
      azureAdObjectId,
      actorUserId
    }
  );

  if (result.rows[0]) {
    return mapRow(result.rows[0]);
  }

  return getUserByIdQuery(client, userId);
}

/**
 * Updates user active state and synchronizes role/application assignments atomically.
 */
export async function updateUserWithAssociationsQuery(
  client: SqlClient,
  input: {
    userId: string;
    isActive: boolean;
    roleId: string;
    applicationIds: string[];
    actorUserId: string;
  }
): Promise<UserEntity | null> {
  const applicationIdsJson = JSON.stringify(input.applicationIds ?? []);

  const result = await executeParameterizedQuery<UserDbRow>(
    client,
    `BEGIN TRY
       BEGIN TRAN;

       DECLARE @updated TABLE
       (
         UserId UNIQUEIDENTIFIER,
         Username NVARCHAR(255),
         Email NVARCHAR(320),
         DisplayName NVARCHAR(255),
         AzureADObjectId NVARCHAR(255),
         IsActive BIT,
         CreateDate DATETIME2,
         CreatedBy NVARCHAR(255),
         UpdateDate DATETIME2,
         UpdatedBy NVARCHAR(255)
       );

       UPDATE app.Users
       SET IsActive = @isActive,
           UpdateDate = SYSUTCDATETIME(),
           UpdatedBy = @actorUserId
       OUTPUT inserted.UserId, inserted.Username, inserted.Email, inserted.DisplayName, inserted.AzureADObjectId, inserted.IsActive, inserted.CreateDate, inserted.CreatedBy, inserted.UpdateDate, inserted.UpdatedBy
       INTO @updated
       WHERE UserId = @userId;

       IF EXISTS (SELECT 1 FROM @updated)
       BEGIN
         MERGE app.UserRoles AS target
         USING (
           SELECT u.UserId, r.RoleId
           FROM @updated u
           INNER JOIN app.Roles r ON r.RoleName = @roleName
         ) AS source
           ON target.UserId = source.UserId
         WHEN MATCHED THEN
           UPDATE SET target.RoleId = source.RoleId,
                      target.AssignedDate = SYSUTCDATETIME(),
                      target.AssignedBy = @actorUserId,
                      target.UpdateDate = SYSUTCDATETIME(),
                      target.UpdatedBy = @actorUserId
         WHEN NOT MATCHED THEN
           INSERT (UserRoleId, UserId, RoleId, AssignedDate, AssignedBy, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
           VALUES (NEWID(), source.UserId, source.RoleId, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId);

         IF (ISJSON(@applicationIdsJson) = 1)
         BEGIN
           MERGE app.UserApplications AS target
           USING (
             SELECT u.UserId, TRY_CONVERT(UNIQUEIDENTIFIER, j.[value]) AS ApplicationId
             FROM @updated u
             CROSS APPLY OPENJSON(@applicationIdsJson) j
             WHERE TRY_CONVERT(UNIQUEIDENTIFIER, j.[value]) IS NOT NULL
           ) AS source
             ON target.UserId = source.UserId AND target.ApplicationId = source.ApplicationId
           WHEN NOT MATCHED BY TARGET THEN
             INSERT (UserApplicationId, UserId, ApplicationId, AssignedDate, AssignedBy, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
             VALUES (NEWID(), source.UserId, source.ApplicationId, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId)
           WHEN NOT MATCHED BY SOURCE AND target.UserId IN (SELECT UserId FROM @updated) THEN
             DELETE;
         END;
       END;

       SELECT UserId, Username, Email, DisplayName, AzureADObjectId, IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy
       FROM @updated;

       COMMIT;
     END TRY
     BEGIN CATCH
       IF (@@TRANCOUNT > 0)
         ROLLBACK;
       THROW;
     END CATCH;`,
    {
      userId: input.userId,
      isActive: input.isActive ? 1 : 0,
      roleName: input.roleId,
      applicationIdsJson,
      actorUserId: input.actorUserId
    }
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}
