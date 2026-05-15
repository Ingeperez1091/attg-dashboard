import { IRoleRepository } from "@/core/domain/repositories/IRoleRepository";
import { IUserRepository } from "@/core/domain/repositories/IUserRepository";

export interface AccessDecision {
  status: number;
  redirectTo?: string;
}

export class AuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly roleRepository: IRoleRepository
  ) {}

  async evaluateAdminUsersAccess(): Promise<AccessDecision> {
    const envUserId = process.env.DEV_SESSION_USER_ID;

    if (!envUserId) {
      return { status: 302, redirectTo: "/login?returnUrl=/admin/users" };
    }

    const user = await this.userRepository.findById(envUserId);
    if (!user) {
      return { status: 302, redirectTo: "/login?returnUrl=/admin/users" };
    }

    if (!user.isActive) {
      return { status: 403, redirectTo: "/dashboard" };
    }

    const role = await this.roleRepository.getRoleByUserId(envUserId);
    if (role !== "administrator") {
      return { status: 403, redirectTo: "/dashboard" };
    }

    return { status: 200 };
  }
}
