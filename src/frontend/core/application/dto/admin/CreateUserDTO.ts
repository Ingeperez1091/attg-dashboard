export interface CreateUserDTO {
  username: string;
  email: string;
  displayName?: string;
  azureAdObjectId?: string;
  isActive: boolean;
  actorUserId: string;
}
