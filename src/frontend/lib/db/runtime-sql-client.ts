import { getSqlConnectionPool } from "@/lib/db/pool";
import { SqlClient, SqlQueryResult } from "@/lib/db/sql-client";

class PoolSqlClient implements SqlClient {
  async query<T>(sql: string, params: Record<string, unknown>): Promise<SqlQueryResult<T>> {
    const pool = await getSqlConnectionPool();
    const request = pool.request();

    for (const [name, value] of Object.entries(params)) {
      request.input(name, value ?? null);
    }

    const result = await request.query<T>(sql);
    return { rows: result.recordset ?? [] };
  }
}

/**
 * Creates the runtime SQL client used by repository resolution in SQL mode.
 */
export function createRuntimeSqlClient(): SqlClient {
  return new PoolSqlClient();
}
