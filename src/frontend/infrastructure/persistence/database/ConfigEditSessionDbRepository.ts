import { SqlClient } from "@/lib/db/sql-client";
import { ConfigEditSession, ActiveEditor } from "@/core/domain/entities/ConfigEditSession";
import { RuleScope } from "@/core/domain/entities/ConfigVersion";
import { IConfigEditSessionRepository, SessionExistsError } from "@/infrastructure/persistence/memory/ConfigEditSessionMemoryRepository";

/**
 * Azure SQL Database implementation of IConfigEditSessionRepository.
 * Uses parameterized SQL for all queries; stale sessions (>5 min without heartbeat)
 * are excluded from active editor results on-access.
 */
export class ConfigEditSessionDbRepository implements IConfigEditSessionRepository {
  constructor(private readonly sqlClient: SqlClient) {}

  async register(
    applicationId: string,
    ruleScope: RuleScope,
    userId: string,
    displayName: string | null
  ): Promise<ConfigEditSession> {
    // Check for existing active non-stale session
    const existing = await this.sqlClient.query<{ SessionId: string }>(
      `SELECT SessionId
       FROM app.ConfigEditSessions
       WHERE ApplicationId = @applicationId
         AND RuleScope = @ruleScope
         AND UserId = @userId
         AND IsActive = 1
         AND LastHeartbeat > DATEADD(MINUTE, -5, SYSUTCDATETIME());`,
      { applicationId, ruleScope, userId }
    );

    if (existing.rows.length > 0) {
      throw new SessionExistsError(existing.rows[0].SessionId);
    }

    // Deactivate any stale sessions for this user/app/scope before inserting
    await this.sqlClient.query(
      `UPDATE app.ConfigEditSessions
       SET IsActive = 0
       WHERE ApplicationId = @applicationId
         AND RuleScope = @ruleScope
         AND UserId = @userId
         AND IsActive = 1;`,
      { applicationId, ruleScope, userId }
    );

    const result = await this.sqlClient.query<{
      sessionId: string;
      applicationId: string;
      ruleScope: RuleScope;
      userId: string;
      displayName: string | null;
      sessionStart: string;
      lastHeartbeat: string;
      isActive: boolean;
    }>(
      `INSERT INTO app.ConfigEditSessions (ApplicationId, RuleScope, UserId, DisplayName)
       OUTPUT
         inserted.SessionId AS sessionId,
         inserted.ApplicationId AS applicationId,
         inserted.RuleScope AS ruleScope,
         inserted.UserId AS userId,
         inserted.DisplayName AS displayName,
         inserted.SessionStart AS sessionStart,
         inserted.LastHeartbeat AS lastHeartbeat,
         inserted.IsActive AS isActive
       VALUES (@applicationId, @ruleScope, @userId, @displayName);`,
      { applicationId, ruleScope, userId, displayName }
    );

    return result.rows[0];
  }

  async heartbeat(sessionId: string, userId: string): Promise<ConfigEditSession | null> {
    const result = await this.sqlClient.query<ConfigEditSession>(
      `UPDATE app.ConfigEditSessions
       SET LastHeartbeat = SYSUTCDATETIME()
       OUTPUT
         inserted.SessionId AS sessionId,
         inserted.ApplicationId AS applicationId,
         inserted.RuleScope AS ruleScope,
         inserted.UserId AS userId,
         inserted.DisplayName AS displayName,
         inserted.SessionStart AS sessionStart,
         inserted.LastHeartbeat AS lastHeartbeat,
         inserted.IsActive AS isActive
       WHERE SessionId = @sessionId
         AND UserId = @userId
         AND IsActive = 1
         AND LastHeartbeat > DATEADD(MINUTE, -5, SYSUTCDATETIME());`,
      { sessionId, userId }
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async release(sessionId: string, userId: string): Promise<boolean> {
    const result = await this.sqlClient.query<{ sessionId: string }>(
      `UPDATE app.ConfigEditSessions
       SET IsActive = 0
       OUTPUT inserted.SessionId AS sessionId
       WHERE SessionId = @sessionId
         AND UserId = @userId
         AND IsActive = 1;`,
      { sessionId, userId }
    );

    return result.rows.length > 0;
  }

  async getActiveEditors(
    applicationId: string,
    ruleScope: RuleScope,
    excludeUserId?: string
  ): Promise<ActiveEditor[]> {
    const query = excludeUserId
      ? `SELECT UserId AS userId, DisplayName AS displayName, SessionStart AS sessionStart
         FROM app.ConfigEditSessions
         WHERE ApplicationId = @applicationId
           AND RuleScope = @ruleScope
           AND IsActive = 1
           AND LastHeartbeat > DATEADD(MINUTE, -5, SYSUTCDATETIME())
           AND UserId <> @excludeUserId
         ORDER BY SessionStart;`
      : `SELECT UserId AS userId, DisplayName AS displayName, SessionStart AS sessionStart
         FROM app.ConfigEditSessions
         WHERE ApplicationId = @applicationId
           AND RuleScope = @ruleScope
           AND IsActive = 1
           AND LastHeartbeat > DATEADD(MINUTE, -5, SYSUTCDATETIME())
         ORDER BY SessionStart;`;

    const params: Record<string, unknown> = { applicationId, ruleScope };
    if (excludeUserId) params.excludeUserId = excludeUserId;

    const result = await this.sqlClient.query<ActiveEditor>(query, params);
    return result.rows;
  }
}
