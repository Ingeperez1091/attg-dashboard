import { SqlClient } from "@/lib/db/sql-client";
import { Application } from "@/core/domain/entities/Application";

/**
 * Lists all active applications ordered by name.
 */
export async function listActiveApplicationsQuery(sqlClient: SqlClient): Promise<Application[]> {
  const sql = `
    SELECT ApplicationId, ApplicationName, Description, IsActive
    FROM app.Applications
    WHERE IsActive = 1
    ORDER BY ApplicationName
  `;
  const result = await sqlClient.query<{
    ApplicationId: string;
    ApplicationName: string;
    Description: string | null;
    IsActive: number;
  }>(sql, {});

  return result.rows.map((row) => ({
    applicationId: row.ApplicationId,
    applicationName: row.ApplicationName,
    description: row.Description ?? "",
    isActive: row.IsActive === 1
  }));
}
