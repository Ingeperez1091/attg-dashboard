export function clearDevSessionForBaselineTests(): void {
  delete process.env.DEV_SESSION_USER_ID;
}
