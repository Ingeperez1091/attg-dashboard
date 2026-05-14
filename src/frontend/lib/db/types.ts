import { RoleName } from "@/core/domain/entities/Role";

export interface UserDbRow {
  UserId: string;
  Username: string;
  Email: string;
  DisplayName: string | null;
  AzureADObjectId: string | null;
  IsActive: boolean;
  CreateDate: string;
  CreatedBy: string;
  UpdateDate: string;
  UpdatedBy: string;
}

export interface RoleNameDbRow {
  RoleName: RoleName;
}

export interface ActiveCountDbRow {
  ActiveCount: number;
}

export interface ApplicationAssignmentDbRow {
  ApplicationId: string;
}