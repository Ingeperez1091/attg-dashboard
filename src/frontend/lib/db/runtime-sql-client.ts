import { getSqlConnectionPool } from "@/lib/db/pool";
import { SqlClient, SqlQueryResult } from "@/lib/db/sql-client";
import { appBootTrace } from "@/lib/runtime-trace";
import sql from "mssql";

/**
 * Resolves the mssql type for a parameter value.
 * Explicit typing prevents type coercion attacks where the driver might
 * interpret a value differently than intended by the query author.
 */
function resolveSqlType(value: unknown): sql.ISqlType | undefined {
  if (value === null || value === undefined) return undefined; // let driver infer NULL
  if (typeof value === "string") return sql.NVarChar(sql.MAX);
  if (typeof value === "number") return Number.isInteger(value) ? sql.Int() : sql.Float();
  if (typeof value === "boolean") return sql.Bit();
  if (value instanceof Date) return sql.DateTime2();
  if (Buffer.isBuffer(value)) return sql.VarBinary(sql.MAX);
  return undefined; // fallback to driver inference for complex types
}

class PoolSqlClient implements SqlClient {
  async query<T>(sqlText: string, params: Record<string, unknown>): Promise<SqlQueryResult<T>> {
    const startedAt = Date.now();
    appBootTrace("sql:query:start", {
      sql: sqlText.slice(0, 200),
      params: Object.keys(params)
    });

    const pool = await getSqlConnectionPool();
    const request = pool.request();

    for (const [name, value] of Object.entries(params)) {
      const resolvedType = resolveSqlType(value);
      if (resolvedType) {
        request.input(name, resolvedType, value);
      } else {
        request.input(name, value ?? null);
      }
    }

    try {
      const result = await request.query<T>(sqlText);
      appBootTrace("sql:query:success", {
        elapsedMs: Date.now() - startedAt,
        rowCount: result.recordset?.length ?? 0,
        sql: sqlText.slice(0, 200)
      });
      return { rows: result.recordset ?? [] };
    } catch (error) {
      appBootTrace("sql:query:error", {
        elapsedMs: Date.now() - startedAt,
        sql: sqlText.slice(0, 200),
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
