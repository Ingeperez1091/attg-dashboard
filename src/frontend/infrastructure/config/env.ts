export type RepositoryMode = "memory" | "database";

export interface AppEnv {
  repositoryMode: RepositoryMode;
}

export function getAppEnv(): AppEnv {
  const useInMemory = process.env.USE_INMEMORY_REPOSITORY === "true";
  return {
    repositoryMode: useInMemory ? "memory" : "database"
  };
}
