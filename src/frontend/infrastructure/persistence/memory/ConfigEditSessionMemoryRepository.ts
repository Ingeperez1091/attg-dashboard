import { ConfigEditSession, ActiveEditor } from "@/core/domain/entities/ConfigEditSession";
import { RuleScope } from "@/core/domain/entities/ConfigVersion";
import { randomUUID } from "node:crypto";

export class SessionExistsError extends Error {
  public readonly existingSessionId: string;
  constructor(existingSessionId: string) {
    super("SESSION_EXISTS");
    this.name = "SessionExistsError";
    this.existingSessionId = existingSessionId;
  }
}

export interface IConfigEditSessionRepository {
  register(
    applicationId: string,
    ruleScope: RuleScope,
    userId: string,
    displayName: string | null
  ): Promise<ConfigEditSession>;

  heartbeat(sessionId: string, userId: string): Promise<ConfigEditSession | null>;

  release(sessionId: string, userId: string): Promise<boolean>;

  getActiveEditors(
    applicationId: string,
    ruleScope: RuleScope,
    excludeUserId?: string
  ): Promise<ActiveEditor[]>;
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * In-memory test double for edit session lifecycle.
 * Simulates register/heartbeat/release/getActiveEditors with stale expiry.
 */
export class ConfigEditSessionMemoryRepository implements IConfigEditSessionRepository {
  private readonly store = new Map<string, ConfigEditSession>();

  async register(
    applicationId: string,
    ruleScope: RuleScope,
    userId: string,
    displayName: string | null
  ): Promise<ConfigEditSession> {
    // Check for existing active session by this user for this app/scope
    for (const session of this.store.values()) {
      if (
        session.applicationId === applicationId &&
        session.ruleScope === ruleScope &&
        session.userId === userId &&
        session.isActive &&
        !this.isStale(session)
      ) {
        throw new SessionExistsError(session.sessionId);
      }
    }

    const now = new Date().toISOString();
    const session: ConfigEditSession = {
      sessionId: randomUUID(),
      applicationId,
      ruleScope,
      userId,
      displayName,
      sessionStart: now,
      lastHeartbeat: now,
      isActive: true,
    };

    this.store.set(session.sessionId, session);
    return session;
  }

  async heartbeat(sessionId: string, userId: string): Promise<ConfigEditSession | null> {
    const session = this.store.get(sessionId);
    if (!session?.isActive || session.userId !== userId) {
      return null;
    }

    session.lastHeartbeat = new Date().toISOString();
    return session;
  }

  async release(sessionId: string, userId: string): Promise<boolean> {
    const session = this.store.get(sessionId);
    if (session?.userId !== userId) {
      return false;
    }

    session.isActive = false;
    return true;
  }

  async getActiveEditors(
    applicationId: string,
    ruleScope: RuleScope,
    excludeUserId?: string
  ): Promise<ActiveEditor[]> {
    const editors: ActiveEditor[] = [];

    for (const session of this.store.values()) {
      if (
        session.applicationId === applicationId &&
        session.ruleScope === ruleScope &&
        session.isActive &&
        !this.isStale(session) &&
        session.userId !== excludeUserId
      ) {
        editors.push({
          userId: session.userId,
          displayName: session.displayName,
          sessionStart: session.sessionStart,
        });
      }
    }

    return editors;
  }

  private isStale(session: ConfigEditSession): boolean {
    const lastBeat = new Date(session.lastHeartbeat).getTime();
    return Date.now() - lastBeat > STALE_THRESHOLD_MS;
  }
}
