import { IUserApplicationRepository } from "@/core/domain/repositories/IUserApplicationRepository";
import { SqlClient } from "@/lib/db/sql-client";
import {
  listApplicationsByUserIdQuery,
  assignApplicationQuery,
  assignAllApplicationsQuery,
  unassignApplicationQuery
} from "./queries/user-application-queries";

export class UserApplicationRepository implements IUserApplicationRepository {
  constructor(private readonly sqlClient: SqlClient) {}

  async listByUserId(userId: string): Promise<string[]> {
    return listApplicationsByUserIdQuery(this.sqlClient, userId);
  }

  async assign(userId: string, applicationId: string, actorUserId: string): Promise<void> {
    return assignApplicationQuery(this.sqlClient, userId, applicationId, actorUserId);
  }

  async assignAll(userId: string, actorUserId: string): Promise<void> {
    return assignAllApplicationsQuery(this.sqlClient, userId, actorUserId);
  }

  async unassign(userId: string, applicationId: string): Promise<boolean> {
    return unassignApplicationQuery(this.sqlClient, userId, applicationId);
  }
}
