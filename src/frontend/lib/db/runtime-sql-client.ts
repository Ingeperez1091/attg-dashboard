import { getSqlConnectionPool } from "@/lib/db/pool";
import { SqlClient, SqlQueryResult } from "@/lib/db/sql-client";
import { appBootTrace } from "@/lib/runtime-trace";

class PoolSqlClient implements SqlClient {
  async query<T>(sql: string, params: Record<string, unknown>): Promise<SqlQueryResult<T>> {
    const startedAt = Date.now();
    appBootTrace("sql:query:start", {
      sql: sql.slice(0, 200),
      params: Object.keys(params)
    });

    const pool = await getSqlConnectionPool();
    const request = pool.request();

    for (const [name, value] of Object.entries(params)) {
      request.input(name, value ?? null);
    }

    try {
      const result = await request.query<T>(sql);
      appBootTrace("sql:query:success", {
        elapsedMs: Date.now() - startedAt,
        rowCount: result.recordset?.length ?? 0,
        sql: sql.slice(0, 200)
      });
      return { rows: result.recordset ?? [] };
    } catch (error) {
      appBootTrace("sql:query:error", {
        elapsedMs: Date.now() - startedAt,
        sql: sql.slice(0, 200),
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

/**
 * Creates the runtime SQL client used by repository resolution in SQL mode.
 */
export function createRuntimeSqlClient(): SqlClient {
  return new PoolSqlClient();
}
