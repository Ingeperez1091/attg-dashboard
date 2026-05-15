export interface SubmitNumeratorRequestDto {
  applicationId: string;
  payload: Record<string, unknown> | unknown[];
}

export interface SubmitNumeratorResponseDto {
  ingestionId: string;
  applicationId: string;
  submittedAt: string;
  status: "staged";
}
