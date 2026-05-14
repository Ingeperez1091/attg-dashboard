import { getAppEnv } from "@/infrastructure/config/env";
import { ApplicationDbRepository } from "@/infrastructure/persistence/database/ApplicationDbRepository";
import { RoleDbRepository } from "@/infrastructure/persistence/database/RoleDbRepository";
import { UserDbRepository } from "@/infrastructure/persistence/database/UserDbRepository";
import { UserApplicationRepository } from "@/infrastructure/persistence/database/UserApplicationRepository";
import { NumeratorFilterDbRepository } from "@/infrastructure/persistence/database/NumeratorFilterDbRepository";
import { NumeratorIngestionDbRepository } from "@/infrastructure/persistence/database/NumeratorIngestionDbRepository";
import { ApplicationMemoryRepository } from "@/infrastructure/persistence/memory/ApplicationMemoryRepository";
import { RoleMemoryRepository } from "@/infrastructure/persistence/memory/RoleMemoryRepository";
import { UserMemoryRepository } from "@/infrastructure/persistence/memory/UserMemoryRepository";
import { NumeratorFilterMemoryRepository } from "@/infrastructure/persistence/memory/NumeratorFilterMemoryRepository";
import { NumeratorIngestionMemoryRepository } from "@/infrastructure/persistence/memory/NumeratorIngestionMemoryRepository";
import { DenominatorModelMemoryRepository } from "@/infrastructure/persistence/memory/DenominatorModelMemoryRepository";
import { DenominatorFilterMemoryRepository } from "@/infrastructure/persistence/memory/DenominatorFilterMemoryRepository";
import { AdoptionSettingsMemoryRepository } from "@/infrastructure/persistence/memory/AdoptionSettingsMemoryRepository";
import { DenominatorAuditMemoryRepository } from "@/infrastructure/persistence/memory/DenominatorAuditMemoryRepository";
import { createRuntimeSqlClient } from "@/lib/db/runtime-sql-client";
import { RepositoryBundle } from "@/core/domain/repositories/RepositoryBundle";
import { DenominatorModelDbRepository } from "@/infrastructure/persistence/database/DenominatorModelDbRepository";
import { DenominatorFilterDbRepository } from "@/infrastructure/persistence/database/DenominatorFilterDbRepository";
import { AdoptionSettingsDbRepository } from "@/infrastructure/persistence/database/AdoptionSettingsDbRepository";
import { DenominatorAuditDbRepository } from "@/infrastructure/persistence/database/DenominatorAuditDbRepository";

export class RepositoryFactory {
  static create(): RepositoryBundle {
    const env = getAppEnv();

    if (env.repositoryMode === "memory") {
      const applications = new ApplicationMemoryRepository();
      return {
        users: new UserMemoryRepository(),
        roles: new RoleMemoryRepository(),
        applications,
        userApplications: applications,
        numeratorFilter: new NumeratorFilterMemoryRepository(),
        ingestionRepository: new NumeratorIngestionMemoryRepository(),
        denominatorModel: new DenominatorModelMemoryRepository(),
        denominatorFilter: new DenominatorFilterMemoryRepository(),
        adoptionSettings: new AdoptionSettingsMemoryRepository(),
        denominatorAudit: new DenominatorAuditMemoryRepository()
      };
    }

    const sqlClient = createRuntimeSqlClient();
    const applications = new ApplicationDbRepository(sqlClient);
    return {
      users: new UserDbRepository(sqlClient),
      roles: new RoleDbRepository(sqlClient),
      applications,
      userApplications: new UserApplicationRepository(sqlClient),
      numeratorFilter: new NumeratorFilterDbRepository(sqlClient),
      ingestionRepository: new NumeratorIngestionDbRepository(sqlClient),
      denominatorModel: new DenominatorModelDbRepository(sqlClient),
      denominatorFilter: new DenominatorFilterDbRepository(sqlClient),
      adoptionSettings: new AdoptionSettingsDbRepository(sqlClient),
      denominatorAudit: new DenominatorAuditDbRepository(sqlClient)
    };
  }
}

