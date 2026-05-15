import { Application } from "@/core/domain/entities/Application";

export interface IApplicationRepository {
  listActive(): Promise<Application[]>;
  listByUserId(userId: string): Promise<string[]>;
  assign(userId: string, applicationId: string, actorUserId: string): Promise<void>;
  assignAll(userId: string, actorUserId: string): Promise<void>;
  unassign(userId: string, applicationId: string): Promise<boolean>;
}
