import { RepositoryBundle } from "@/core/domain/repositories/RepositoryBundle";
import { RepositoryFactory } from "@/infrastructure/factories/RepositoryFactory";
import { NumeratorIngestionMemoryRepository } from "@/infrastructure/persistence/memory/NumeratorIngestionMemoryRepository";
import { INumeratorIngestionRepository } from "@/core/domain/repositories/INumeratorIngestionRepository";
import { IValidationPipelineRepository } from "@/core/domain/repositories/IValidationPipelineRepository";
import { INumeratorFilterRepository } from "@/core/domain/repositories/INumeratorFilterRepository";
import { IDenominatorModelRepository } from "@/core/domain/repositories/IDenominatorModelRepository";
import { IDenominatorFilterRepository } from "@/core/domain/repositories/IDenominatorFilterRepository";
import { IAdoptionSettingsRepository } from "@/core/domain/repositories/IAdoptionSettingsRepository";
import { IDenominatorAuditRepository } from "@/core/domain/repositories/IDenominatorAuditRepository";
import { getAppEnv } from "@/infrastructure/config/env";
import { createRuntimeSqlClient } from "@/lib/db/runtime-sql-client";
import { ValidationPipelineDbRepository } from "@/infrastructure/persistence/database/ValidationPipelineDbRepository";
import { ValidationPipelineMemoryRepository } from "@/infrastructure/persistence/memory/ValidationPipelineMemoryRepository";
import { IADFPipelineClient } from "@/core/application/clients/IADFPipelineClient";
import { ADFPipelineClient } from "@/infrastructure/clients/ADFPipelineClient";
import { IMetricsRepository } from "@/core/domain/repositories/metricsRepository";
import { MetricsDbRepository } from "@/infrastructure/persistence/database/MetricsDbRepository";
import { MetricsMemoryRepository } from "@/infrastructure/persistence/memory/MetricsMemoryRepository";
import { DashboardUsageRepository } from "@/core/domain/repositories/dashboardUsageRepository";
import { DashboardUsageDbRepository } from "@/infrastructure/persistence/database/DashboardUsageDbRepository";
import { DashboardUsageMemoryRepository } from "@/infrastructure/persistence/memory/DashboardUsageMemoryRepository";
import { createRepositoryTraceProxy } from "@/lib/runtime-trace";
import { IDenominatorPreviewRepository } from "@/core/domain/repositories/IDenominatorPreviewRepository";
import { DenominatorPreviewMemoryRepository } from "@/infrastructure/persistence/memory/DenominatorPreviewMemoryRepository";
import { DenominatorPreviewDbRepository } from "@/infrastructure/persistence/database/DenominatorPreviewDbRepository";
import { IConfigVersionRepository } from "@/core/domain/repositories/IConfigVersionRepository";
import { ConfigVersionMemoryRepository } from "@/infrastructure/persistence/memory/ConfigVersionMemoryRepository";
import { ConfigVersionDbRepository } from "@/infrastructure/persistence/database/ConfigVersionDbRepository";
import { IConfigEditSessionRepository, ConfigEditSessionMemoryRepository } from "@/infrastructure/persistence/memory/ConfigEditSessionMemoryRepository";
import { ConfigEditSessionDbRepository } from "@/infrastructure/persistence/database/ConfigEditSessionDbRepository";

declare global {
  var __attgRuntimeRepositories: RepositoryBundle | undefined;
}

let repositoryBundle: RepositoryBundle | null = globalThis.__attgRuntimeRepositories ?? null;
let validationPipelineRepository: IValidationPipelineRepository | null = null;
let adfPipelineClient: IADFPipelineClient | null = null;
let metricsRepository: IMetricsRepository | null = null;
let dashboardUsageRepository: DashboardUsageRepository | null = null;
let denominatorPreviewRepository: IDenominatorPreviewRepository | null = null;
let configVersionRepository: IConfigVersionRepository | null = null;
let configEditSessionRepository: IConfigEditSessionRepository | null = null;

function clearInMemoryRepoStoresForTests(): void {
  const globalStore = globalThis as typeof globalThis & {
    __dashboardApplicationRepoStore?: unknown;
    __dashboardRoleRepoStore?: unknown;
    __dashboardUserRepoStore?: unknown;
    __dashboardNumeratorIngestionRepoStore?: unknown;
    __dashboardFilterRepoStore?: unknown;
    __dashboardDenominatorFilterRepoStore?: unknown;
    __dashboardAdoptionSettingsRepoStore?: unknown;
    __dashboardDenominatorAuditRepoStore?: unknown;
    __dashboardValidationPipelineRepoStore?: unknown;
    __dashboardMetricsRepoStore?: unknown;
    __dashboardUsageRepoStore?: unknown;
  };

  globalStore.__dashboardApplicationRepoStore = undefined;
  globalStore.__dashboardRoleRepoStore = undefined;
  globalStore.__dashboardUserRepoStore = undefined;
  globalStore.__dashboardNumeratorIngestionRepoStore = undefined;
  globalStore.__dashboardFilterRepoStore = undefined;
  globalStore.__dashboardDenominatorFilterRepoStore = undefined;
  globalStore.__dashboardAdoptionSettingsRepoStore = undefined;
  globalStore.__dashboardDenominatorAuditRepoStore = undefined;
  globalStore.__dashboardValidationPipelineRepoStore = undefined;
  globalStore.__dashboardMetricsRepoStore = undefined;
  globalStore.__dashboardUsageRepoStore = undefined;
}

export function getRuntimeRepositories(): RepositoryBundle {
  if (!repositoryBundle) {
    repositoryBundle = RepositoryFactory.create();
    globalThis.__attgRuntimeRepositories = repositoryBundle;
  }

  return repositoryBundle;
}

export function resetRuntimeRepositoriesForTests(): void {
  repositoryBundle = null;
  validationPipelineRepository = null;
  adfPipelineClient = null;
  metricsRepository = null;
  dashboardUsageRepository = null;
  denominatorPreviewRepository = null;
  configVersionRepository = null;
  configEditSessionRepository = null;
  globalThis.__attgRuntimeRepositories = undefined;
  clearInMemoryRepoStoresForTests();
}

export function getRuntimeValidationPipelineRepository(): IValidationPipelineRepository {
  if (validationPipelineRepository) {
    return validationPipelineRepository;
  }

  const env = getAppEnv();
  validationPipelineRepository = env.repositoryMode === "memory"
    ? new ValidationPipelineMemoryRepository()
    : createRepositoryTraceProxy(new ValidationPipelineDbRepository(createRuntimeSqlClient()), "validationPipelineRepository");

  return validationPipelineRepository;
}

export function getRuntimeADFPipelineClient(): IADFPipelineClient {
  adfPipelineClient ??= new ADFPipelineClient();

  return adfPipelineClient;
}

export function getRuntimeMetricsRepository(): IMetricsRepository {
  if (metricsRepository) {
    return metricsRepository;
  }

  const env = getAppEnv();
  metricsRepository = env.repositoryMode === "memory"
    ? new MetricsMemoryRepository()
    : createRepositoryTraceProxy(new MetricsDbRepository(createRuntimeSqlClient()), "metricsRepository");

  return metricsRepository;
}

export function getRuntimeDashboardUsageRepository(): DashboardUsageRepository {
  if (dashboardUsageRepository) {
    return dashboardUsageRepository;
  }

  const env = getAppEnv();
  dashboardUsageRepository = env.repositoryMode === "memory"
    ? new DashboardUsageMemoryRepository()
    : createRepositoryTraceProxy(new DashboardUsageDbRepository(createRuntimeSqlClient()), "dashboardUsageRepository");

  return dashboardUsageRepository;
}

export function getRuntimeNumeratorIngestionRepository(): INumeratorIngestionRepository {
  return getRuntimeRepositories().ingestionRepository;
}

export function getRuntimeNumeratorFilterRepository(): INumeratorFilterRepository {
  return getRuntimeRepositories().numeratorFilter;
}

export function getRuntimeDenominatorModelRepository(): IDenominatorModelRepository {
  return getRuntimeRepositories().denominatorModel;
}

export function getRuntimeDenominatorFilterRepository(): IDenominatorFilterRepository {
  return getRuntimeRepositories().denominatorFilter;
}

export function getRuntimeAdoptionSettingsRepository(): IAdoptionSettingsRepository {
  return getRuntimeRepositories().adoptionSettings;
}

export function getRuntimeDenominatorAuditRepository(): IDenominatorAuditRepository {
  return getRuntimeRepositories().denominatorAudit;
}

export interface NumeratorIngestionDependencies {
  repositories: RepositoryBundle;
  ingestionRepository: INumeratorIngestionRepository;
}

export function getNumeratorIngestionDependencies(): NumeratorIngestionDependencies {
  const repositories = getRuntimeRepositories();
  return { repositories, ingestionRepository: repositories.ingestionRepository };
}

export function resetNumeratorIngestionRepositoryForTests(): void {
  resetRuntimeRepositoriesForTests();
}

export function resetRuntimeNumeratorFilterRepositoryForTests(): void {
  resetRuntimeRepositoriesForTests();
}

export function resetRuntimeDenominatorFilterRepositoryForTests(): void {
  resetRuntimeRepositoriesForTests();
}

export function listInMemoryStagedRowsForTests() {
  const repo = getRuntimeRepositories().ingestionRepository;
  if (repo instanceof NumeratorIngestionMemoryRepository) {
    return repo.listStagedRowsForTests();
  }

  return [];
}

export function logRepositoryMode(): void {
  const env = getAppEnv();
  console.info(`[repository-mode] active=${env.repositoryMode}`);
}

export function getRuntimeDenominatorPreviewRepository(): IDenominatorPreviewRepository {
  if (denominatorPreviewRepository) {
    return denominatorPreviewRepository;
  }

  const env = getAppEnv();
  denominatorPreviewRepository = env.repositoryMode === "memory"
    ? new DenominatorPreviewMemoryRepository()
    : createRepositoryTraceProxy(new DenominatorPreviewDbRepository(createRuntimeSqlClient()), "denominatorPreviewRepository");

  return denominatorPreviewRepository;
}

export function getRuntimeConfigVersionRepository(): IConfigVersionRepository {
  if (configVersionRepository) {
    return configVersionRepository;
  }

  const env = getAppEnv();
  configVersionRepository = env.repositoryMode === "memory"
    ? new ConfigVersionMemoryRepository()
    : createRepositoryTraceProxy(new ConfigVersionDbRepository(createRuntimeSqlClient()), "configVersionRepository");

  return configVersionRepository;
}

export function getRuntimeConfigEditSessionRepository(): IConfigEditSessionRepository {
  if (configEditSessionRepository) {
    return configEditSessionRepository;
  }

  const env = getAppEnv();
  configEditSessionRepository = env.repositoryMode === "memory"
    ? new ConfigEditSessionMemoryRepository()
    : createRepositoryTraceProxy(new ConfigEditSessionDbRepository(createRuntimeSqlClient()), "configEditSessionRepository");

  return configEditSessionRepository;
}
