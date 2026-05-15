import { RoleName } from "@/core/domain/entities/Role";

export interface User {
  userId: string;
  username: string;
  email: string;
  displayName: string | null;
  azureAdObjectId: string | null;
  role: RoleName;
  applicationIds: string[];
  isActive: boolean;
  createDate: string;
  createdBy: string;
  updateDate: string;
  updatedBy: string;
}
