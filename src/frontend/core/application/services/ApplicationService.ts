import { Application } from "@/core/domain/entities/Application";
import { IApplicationRepository } from "@/core/domain/repositories/IApplicationRepository";

export class ApplicationService {
  constructor(private readonly applicationRepository: IApplicationRepository) {}

  async listActiveApplications(): Promise<Application[]> {
    return this.applicationRepository.listActive();
  }
}

