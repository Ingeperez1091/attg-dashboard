import { CreateUserDTO } from "@/core/application/dto/admin/CreateUserDTO";
import { CreateUserWithAssociationsDTO } from "@/core/application/dto/admin/CreateUserWithAssociationsDTO";
import { UpdateUserWithAssociationsDTO } from "@/core/application/dto/admin/UpdateUserWithAssociationsDTO";
import { User } from "@/core/domain/entities/User";
import { RoleName } from "@/core/domain/entities/Role";
import { IApplicationRepository } from "@/core/domain/repositories/IApplicationRepository";
import { IRoleRepository } from "@/core/domain/repositories/IRoleRepository";
import { IUserRepository } from "@/core/domain/repositories/IUserRepository";
import { AppError } from "@/lib/api/error-handler";

type AtomicCreateRepository = IUserRepository & {
  createWithAssociations: (
    input: CreateUserDTO,
    options: { roleId?: RoleName; applicationIds?: string[] }
  ) => Promise<User>;
};

type AtomicUpdateRepository = IUserRepository & {
  updateWithAssociations: (input: {
    userId: string;
    isActive: boolean;
    roleId: RoleName;
    applicationIds: string[];
    actorUserId: string;
  }) => Promise<User | null>;
};

function supportsAtomicCreate(repo: IUserRepository): repo is AtomicCreateRepository {
  return typeof (repo as AtomicCreateRepository).createWithAssociations === "function";
}

function supportsAtomicUpdate(repo: IUserRepository): repo is AtomicUpdateRepository {
  return typeof (repo as AtomicUpdateRepository).updateWithAssociations === "function";
}

export class UserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly roleRepository: IRoleRepository,
    private readonly applicationRepository: IApplicationRepository
  ) {}

  async listUsers(includeInactive = false): Promise<User[]> {
    return this.userRepository.list(includeInactive);
  }

  async getUserById(userId: string): Promise<User | null> {
    return this.userRepository.findById(userId);
  }

  async getUserRoleByUserId(userId: string): Promise<User["role"]> {
    return (await this.roleRepository.getRoleByUserId(userId)) ?? "viewer";
  }

  async getUserApplicationsByUserId(userId: string): Promise<string[]> {
    return this.applicationRepository.listByUserId(userId);
  }

  async countActiveByRole(role: User["role"]): Promise<number> {
    return this.roleRepository.countActiveByRole(role);
  }

  async createUser(dto: CreateUserDTO): Promise<User> {
    const created = await this.userRepository.create(dto);
    return created;
  }

  async createUserWithAssociations(dto: CreateUserWithAssociationsDTO): Promise<User> {
    const createInput: CreateUserDTO = {
      username: dto.username.trim(),
      email: dto.email.trim().toLowerCase(),
      displayName: dto.displayName?.trim(),
      azureAdObjectId: dto.azureAdObjectId,
      isActive: dto.isActive,
      actorUserId: dto.actorUserId
    };

    const roleId = dto.roleId;
    const applicationIds = dto.applicationIds ?? [];

    if (supportsAtomicCreate(this.userRepository)) {
      return this.userRepository.createWithAssociations(createInput, {
        roleId,
        applicationIds
      });
    }

    const created = await this.userRepository.create(createInput);

    if (roleId && roleId !== "viewer") {
      await this.roleRepository.assignRole(created.userId, roleId, dto.actorUserId);
    }

    for (const applicationId of applicationIds) {
      await this.applicationRepository.assign(created.userId, applicationId, dto.actorUserId);
    }

    return created;
  }

  async updateUserWithAssociations(dto: UpdateUserWithAssociationsDTO): Promise<User | null> {
    const targetUser = await this.userRepository.findById(dto.userId);
    if (!targetUser) {
      return null;
    }

    if (supportsAtomicUpdate(this.userRepository)) {
      return this.userRepository.updateWithAssociations({
        userId: dto.userId,
        isActive: dto.isActive,
        roleId: dto.roleId,
        applicationIds: dto.applicationIds,
        actorUserId: dto.actorUserId
      });
    }

    const updated = await this.userRepository.updateIsActive(dto.userId, dto.isActive, dto.actorUserId);
    if (!updated) {
      return null;
    }

    await this.roleRepository.assignRole(dto.userId, dto.roleId, dto.actorUserId);

    const currentApplications = await this.applicationRepository.listByUserId(dto.userId);
    const toAdd = dto.applicationIds.filter((applicationId) => !currentApplications.includes(applicationId));
    const toRemove = currentApplications.filter((applicationId) => !dto.applicationIds.includes(applicationId));

    for (const applicationId of toAdd) {
      await this.applicationRepository.assign(dto.userId, applicationId, dto.actorUserId);
    }

    for (const applicationId of toRemove) {
      await this.applicationRepository.unassign(dto.userId, applicationId);
    }

    return this.userRepository.findById(dto.userId);
  }

  async assignApplication(userId: string, applicationId: string, actorUserId: string): Promise<void> {
    await this.applicationRepository.assign(userId, applicationId, actorUserId);
  }

  async assignRole(userId: string, role: User["role"], actorUserId: string): Promise<void> {
    await this.roleRepository.assignRole(userId, role, actorUserId);
  }

  async assignUserRole(userId: string, role: User["role"], actorUserId: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return false;
    }

    await this.roleRepository.assignRole(userId, role, actorUserId);
    return true;
  }

  async listUserApplications(userId: string): Promise<string[] | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return null;
    }

    return this.applicationRepository.listByUserId(userId);
  }

  async assignUserApplications(
    userId: string,
    input: { all?: boolean; applicationId?: string; actorUserId: string }
  ): Promise<string[] | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return null;
    }

    const assigned: string[] = [];
    if (input.all) {
      await this.applicationRepository.assignAll(userId, input.actorUserId);
      assigned.push("*");
    }

    if (input.applicationId) {
      await this.applicationRepository.assign(userId, input.applicationId, input.actorUserId);
      assigned.push(input.applicationId);
    }

    return assigned;
  }

  async unassignUserApplication(userId: string, applicationId: string): Promise<boolean | null> {
    if (applicationId === "*") {
      throw new AppError(403, "FORBIDDEN", "Cannot delete wildcard assignment through this route.");
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      return null;
    }

    return this.applicationRepository.unassign(userId, applicationId);
  }
}

