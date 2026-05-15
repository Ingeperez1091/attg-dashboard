import { ConnectionPool } from "mssql";

let poolPromise: Promise<ConnectionPool> | null = null;

type SqlAuthPoolConfig = {
  server: string;
  database: string;
  user: string;
  password: string;
  port?: number;
  options?: {
    encrypt?: boolean;
    trustServerCertificate?: boolean;
    instanceName?: string;
  };
};

function getEnvValue(key: string): string | undefined {
  const direct = process.env[key];
  if (typeof direct === "string") {
    return direct;
  }

  const appSetting = process.env[`APPSETTING_${key}`];
  if (typeof appSetting === "string") {
    return appSetting;
  }

  return undefined;
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  return value.trim().toLowerCase() === "true";
}

function parseSqlPortFromEnv(): number | undefined {
  const portRaw = getEnvValue("SQL_PORT")?.trim();

  if (!portRaw) {
    return undefined;
  }

  const parsed = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("SQL_PORT must be a positive integer when provided.");
  }

  return parsed;
}

function buildTrustedConnectionStringFromSqlEnv(): string | null {
  const server = getEnvValue("SQL_SERVER")?.trim();
  const instance = getEnvValue("SQL_INSTANCE")?.trim();
  const database = getEnvValue("SQL_DATABASE")?.trim();
  const port = parseSqlPortFromEnv();
  const encrypt = parseBooleanEnv(getEnvValue("SQL_ENCRYPT"));
  const trustServerCertificate = parseBooleanEnv(getEnvValue("SQL_TRUST_SERVER_CERT"));

  if (!server || !database) {
    return null;
  }

  const serverTarget = port !== undefined
    ? `${server},${port}`
    : instance
      ? `${server}\\${instance}`
      : server;

  const parts: string[] = [
    `Server=${serverTarget}`,
    `Database=${database}`,
    "Trusted_Connection=True",
    "Integrated Security=True"
  ];

  if (encrypt !== undefined) {
    parts.push(`Encrypt=${encrypt ? "True" : "False"}`);
  }

  if (trustServerCertificate !== undefined) {
    parts.push(`TrustServerCertificate=${trustServerCertificate ? "True" : "False"}`);
  }

  return `${parts.join(";")};`;
}

function buildSqlAuthPoolConfigFromSqlEnv(): SqlAuthPoolConfig | null {
  const server = getEnvValue("SQL_SERVER")?.trim();
  const instance = getEnvValue("SQL_INSTANCE")?.trim();
  const database = getEnvValue("SQL_DATABASE")?.trim();
  const user = getEnvValue("SQL_USER")?.trim();
  const password = getEnvValue("SQL_PASSWORD")?.trim();
  const encrypt = parseBooleanEnv(getEnvValue("SQL_ENCRYPT"));
  const trustServerCertificate = parseBooleanEnv(getEnvValue("SQL_TRUST_SERVER_CERT"));
  const trustedConnection = parseBooleanEnv(getEnvValue("TRUSTED_CONNECTION")) === true;
  const port = parseSqlPortFromEnv();

  if (!server || !database || trustedConnection) {
    return null;
  }

  if (!user) {
    throw new Error("SQL_USER is required when TRUSTED_CONNECTION is false.");
  }

  if (!password) {
    throw new Error("SQL_PASSWORD is required when TRUSTED_CONNECTION is false.");
  }

  const options: SqlAuthPoolConfig["options"] = {};

  if (encrypt !== undefined) {
    options.encrypt = encrypt;
  }

  if (trustServerCertificate !== undefined) {
    options.trustServerCertificate = trustServerCertificate;
  }

  if (port === undefined && instance && instance.length > 0) {
    options.instanceName = instance;
  }

  return {
    server,
    database,
    user,
    password,
    ...(port !== undefined ? { port } : {}),
    ...(Object.keys(options).length > 0 ? { options } : {})
  };
}

function resolveConnectionString(): string {
  const trustedConnection = parseBooleanEnv(getEnvValue("TRUSTED_CONNECTION")) === true;
  const hasExplicitSqlConfig = Boolean(
    getEnvValue("SQL_SERVER")?.trim() && getEnvValue("SQL_DATABASE")?.trim()
  );

  if (trustedConnection && hasExplicitSqlConfig) {
    const builtConnectionString = buildTrustedConnectionStringFromSqlEnv();
    if (builtConnectionString) {
      return builtConnectionString;
    }
  }

  const connectionString = getEnvValue("DATABASE_URL") ?? getEnvValue("SQL_CONNECTION_STRING");

  if (connectionString && connectionString.trim().length > 0) {
    return connectionString;
  }

  if (trustedConnection) {
    throw new Error(
      "TRUSTED_CONNECTION=true is set, but SQL_SERVER/SQL_DATABASE were not provided. Set SQL_* values or configure DATABASE_URL."
    );
  }

  throw new Error("DATABASE_URL or SQL_SERVER/SQL_DATABASE-based configuration is required to initialize SQL connection pool.");
}

async function connectWithResolvedDriver(connectionString: string, trustedConnection: boolean): Promise<ConnectionPool> {
  if (!trustedConnection) {
    const pool = new ConnectionPool(connectionString);
    return pool.connect();
  }

  try {
    // Trusted Windows auth requires the msnodesqlv8-backed mssql entrypoint.
    const moduleName = "mssql/msnodesqlv8";
    const importDynamic = new Function("m", "return import(m)") as (m: string) => Promise<unknown>;
    const sql = await importDynamic(moduleName);
    const MsNodePool = (sql as { ConnectionPool: typeof ConnectionPool }).ConnectionPool;
    const pool = new MsNodePool(connectionString);
    return pool.connect();
  } catch {
    throw new Error(
      "TRUSTED_CONNECTION=true requires Windows integrated auth driver support. Install 'msnodesqlv8' and the Microsoft SQL Server ODBC driver, or set TRUSTED_CONNECTION=false and provide SQL_USER/SQL_PASSWORD."
    );
  }
}

/**
 * Returns a singleton SQL connection pool for the application process.
 */
export function getSqlConnectionPool(): Promise<ConnectionPool> {
  if (!poolPromise) {
    const trustedConnection = parseBooleanEnv(getEnvValue("TRUSTED_CONNECTION")) === true;
    poolPromise = (async () => {
      if (!trustedConnection) {
        const sqlAuthConfig = buildSqlAuthPoolConfigFromSqlEnv();
        if (sqlAuthConfig) {
          const pool = new ConnectionPool(sqlAuthConfig);
          return pool.connect();
        }
      }

      return connectWithResolvedDriver(resolveConnectionString(), trustedConnection);
    })().catch((error: unknown) => {
      const e = error as { code?: string; originalError?: { message?: string } };
      const originalMessage = e.originalError?.message ?? "";

      if (e.code === "ELOGIN" && originalMessage.includes("Login failed for user ''")) {
        throw new Error(
          "SQL authentication attempted with an empty username. If using SQL auth, set TRUSTED_CONNECTION=false and provide SQL_USER/SQL_PASSWORD. If using Windows auth, install and use the msnodesqlv8 driver path."
        );
      }

      throw error;
    });
  }

  return poolPromise as Promise<ConnectionPool>;
}

/**
 * Test utility to clear pool singleton between suites.
 */
export function resetSqlConnectionPoolForTests(): void {
  poolPromise = null;
}