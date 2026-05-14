import { RoleName } from "@/core/domain/entities/Role";

export interface SessionEntity {
  userId: string;
  role: RoleName;
  isActive: boolean;
  applications: string[];
}
