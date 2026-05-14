import { RoleName } from "@/core/domain/entities/Role";

export interface AdminUserDto {
  userId: string;
  email: string;
  displayName: string | null;
  azureAdObjectId: string | null;
  role: RoleName;
  applications: string[];
  isActive: boolean;
  createDate: string;
  createdBy: string;
  updateDate: string;
  updatedBy: string;
}
