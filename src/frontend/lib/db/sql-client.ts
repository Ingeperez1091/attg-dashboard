export interface SqlQueryResult<T> {
  rows: T[];
}

export interface SqlClient {
  query<T>(sql: string, params: Record<string, unknown>): Promise<SqlQueryResult<T>>;
}

/**
 * Guards against string interpolation in SQL text to enforce parameterized execution.
 */
export function assertParameterizedSql(sql: string): void {
  if (sql.includes("${")) {
    throw new Error("Interpolated SQL is forbidden. Use named parameters only.");
  }
}

/**
 * Executes a parameterized SQL query using the provided SqlClient.
 */
export async function executeParameterizedQuery<T>(
  client: SqlClient,
  sql: string,
  params: Record<string, unknown>
): Promise<SqlQueryResult<T>> {
  assertParameterizedSql(sql);
  return client.query<T>(sql, params);
}
