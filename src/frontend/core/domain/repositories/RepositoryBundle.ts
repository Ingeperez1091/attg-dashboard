import { IApplicationRepository } from "@/core/domain/repositories/IApplicationRepository";
import { IRoleRepository } from "@/core/domain/repositories/IRoleRepository";
import { IUserApplicationRepository } from "@/core/domain/repositories/IUserApplicationRepository";
import { IUserRepository } from "@/core/domain/repositories/IUserRepository";
import { INumeratorFilterRepository } from "@/core/domain/repositories/INumeratorFilterRepository";
import { INumeratorIngestionRepository } from "@/core/domain/repositories/INumeratorIngestionRepository";
import { IDenominatorModelRepository } from "@/core/domain/repositories/IDenominatorModelRepository";
import { IDenominatorFilterRepository } from "@/core/domain/repositories/IDenominatorFilterRepository";
import { IAdoptionSettingsRepository } from "@/core/domain/repositories/IAdoptionSettingsRepository";
import { IDenominatorAuditRepository } from "@/core/domain/repositories/IDenominatorAuditRepository";

export interface RepositoryBundle {
  users: IUserRepository;
  roles: IRoleRepository;
  userApplications: IUserApplicationRepository;
  applications: IApplicationRepository;
  numeratorFilter: INumeratorFilterRepository;
  ingestionRepository: INumeratorIngestionRepository;
  denominatorModel: IDenominatorModelRepository;
  denominatorFilter: IDenominatorFilterRepository;
  adoptionSettings: IAdoptionSettingsRepository;
  denominatorAudit: IDenominatorAuditRepository;
}
