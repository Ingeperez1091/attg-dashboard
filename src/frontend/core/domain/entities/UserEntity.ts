export interface UserEntity {
  userId: string;
  username: string;
  email: string;
  displayName: string | null;
  azureAdObjectId: string | null;
  isActive: boolean;
  createDate: string;
  createdBy: string;
  updateDate: string;
  updatedBy: string;
}
