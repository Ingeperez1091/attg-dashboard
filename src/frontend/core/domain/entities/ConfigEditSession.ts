import { RuleScope } from "@/core/domain/entities/ConfigVersion";

export interface ConfigEditSession {
  sessionId: string;
  applicationId: string;
  ruleScope: RuleScope;
  userId: string;
  displayName: string | null;
  sessionStart: string;
  lastHeartbeat: string;
  isActive: boolean;
}

export interface ActiveEditor {
  userId: string;
  displayName: string | null;
  sessionStart: string;
}
