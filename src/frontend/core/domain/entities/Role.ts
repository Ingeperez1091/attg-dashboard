export type RoleName = "administrator" | "application_owner" | "viewer";

export interface Role {
  roleId: RoleName;
  roleName: string;
  isActive: boolean;
}
