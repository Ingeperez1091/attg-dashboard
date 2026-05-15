import { User } from "@/core/domain/entities/User";

export interface IUserRepository {
  findById(userId: string): Promise<User | null>;
  findByAzureAdObjectId(azureAdObjectId: string): Promise<User | null>;
  list(includeInactive?: boolean): Promise<User[]>;
  create(input: {
    username: string;
    email: string;
    displayName?: string;
    azureAdObjectId?: string;
    isActive: boolean;
    actorUserId: string;
  }): Promise<User>;
  bindAzureAdObjectId(userId: string, azureAdObjectId: string, actorUserId: string): Promise<User | null>;
  updateIsActive(userId: string, isActive: boolean, actorUserId: string): Promise<User | null>;
}
