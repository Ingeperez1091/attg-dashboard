import { User } from "@/core/domain/entities/User";
import { IUserRepository } from "@/core/domain/repositories/IUserRepository";
import { SqlClient } from "@/lib/db/sql-client";
import {
  getUserByIdQuery,
  getUserByAzureAdObjectIdQuery,
  listUsersQuery,
  createUserQuery,
  bindUserAzureAdObjectIdQuery,
  updateUserIsActiveQuery,
  createUserWithAssociationsQuery,
  updateUserWithAssociationsQuery
} from "./queries/user-queries";

export class UserDbRepository implements IUserRepository {
  constructor(private readonly sqlClient: SqlClient) {}

  async getById(userId: string): Promise<User | null> {
    return this.findById(userId);
  }

  async findById(userId: string): Promise<User | null> {
    const user = await getUserByIdQuery(this.sqlClient, userId);
    return user ? this.mapToEntity(user, "viewer", []) : null;
  }

  async findByAzureAdObjectId(azureAdObjectId: string): Promise<User | null> {
    const user = await getUserByAzureAdObjectIdQuery(this.sqlClient, azureAdObjectId);
    return user ? this.mapToEntity(user, "viewer", []) : null;
  }

  async list(includeInactive = false): Promise<User[]> {
    const users = await listUsersQuery(this.sqlClient, includeInactive);
    return users.map((u) => this.mapToEntity(u, "viewer", []));
  }

  async create(input: {
    username: string;
    email: string;
    displayName?: string;
    azureAdObjectId?: string;
    isActive: boolean;
    actorUserId: string;
  }): Promise<User> {
    const created = await createUserQuery(this.sqlClient, input);
    return this.mapToEntity(created, "viewer", []);
  }

  async createWithAssociations(input: {
    username: string;
    email: string;
    displayName?: string;
    azureAdObjectId?: string;
    isActive: boolean;
    actorUserId: string;
  }, options: { roleId?: User["role"]; applicationIds?: string[] }): Promise<User> {
    const created = await createUserWithAssociationsQuery(this.sqlClient, input, options);
    return this.mapToEntity(created, options.roleId ?? "viewer", options.applicationIds ?? []);
  }

  async updateIsActive(userId: string, isActive: boolean, actorUserId: string): Promise<User | null> {
    const updated = await updateUserIsActiveQuery(this.sqlClient, userId, isActive, actorUserId);
    return updated ? this.mapToEntity(updated, "viewer", []) : null;
  }

  async bindAzureAdObjectId(userId: string, azureAdObjectId: string, actorUserId: string): Promise<User | null> {
    const updated = await bindUserAzureAdObjectIdQuery(this.sqlClient, userId, azureAdObjectId, actorUserId);
    return updated ? this.mapToEntity(updated, "viewer", []) : null;
  }

  async updateWithAssociations(input: {
    userId: string;
    isActive: boolean;
    roleId: User["role"];
    applicationIds: string[];
    actorUserId: string;
  }): Promise<User | null> {
    const updated = await updateUserWithAssociationsQuery(this.sqlClient, input);
    return updated ? this.mapToEntity(updated, input.roleId, input.applicationIds) : null;
  }

  private mapToEntity(
    row: Awaited<ReturnType<typeof getUserByIdQuery>> extends infer R ? Exclude<R, null> : never,
    role: User["role"],
    applicationIds: string[]
  ): User {
    return {
      userId: row.userId,
      username: row.username,
      email: row.email,
      displayName: row.displayName,
      azureAdObjectId: row.azureAdObjectId ?? null,
      role,
      applicationIds,
      isActive: row.isActive,
      createDate: row.createDate,
      createdBy: row.createdBy,
      updateDate: row.updateDate,
      updatedBy: row.updatedBy
    };
  }
}

