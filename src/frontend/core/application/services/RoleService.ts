import { Role } from "@/core/domain/entities/Role";
import { IRoleRepository } from "@/core/domain/repositories/IRoleRepository";

export class RoleService {
  constructor(private readonly roleRepository: IRoleRepository) {}

  async listRoles(): Promise<Role[]> {
    return this.roleRepository.listRoles();
  }
}

