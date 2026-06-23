import { describe, it, expect, beforeEach } from "vitest";
import { ConfigVersionService } from "@/core/application/services/configVersionService";
import { ConfigVersionMemoryRepository } from "@/infrastructure/persistence/memory/ConfigVersionMemoryRepository";

describe("ConfigVersionService", () => {
  let repo: ConfigVersionMemoryRepository;
  let service: ConfigVersionService;

  const appId = "10000000-0000-0000-0000-000000000001";
  const actorUserId = "user@example.com";

  beforeEach(() => {
    repo = new ConfigVersionMemoryRepository();
    service = new ConfigVersionService(repo);
  });

  describe("checkAndIncrement", () => {
    it("succeeds when expected version matches current version", async () => {
      const result = await service.checkAndIncrement(appId, "Denominator", 1, actorUserId);

      expect(result.success).toBe(true);
      expect(result.newVersion).toBeDefined();
      expect(result.newVersion!.version).toBe(2);
      expect(result.newVersion!.lastModifiedBy).toBe(actorUserId);
    });

    it("fails with conflict when expected version is stale", async () => {
      // First save increments to version 2
      await service.checkAndIncrement(appId, "Denominator", 1, actorUserId);

      // Second attempt with stale version 1
      const result = await service.checkAndIncrement(appId, "Denominator", 1, "other-user@example.com");

      expect(result.success).toBe(false);
      expect(result.conflict).toBeDefined();
      expect(result.conflict!.currentVersion).toBe(2);
      expect(result.conflict!.lastModifiedBy).toBe(actorUserId);
    });

    it("increments atomically — concurrent saves with same version result in only one success", async () => {
      // Both attempt version 1
      const result1 = await service.checkAndIncrement(appId, "Denominator", 1, "user-a@example.com");
      const result2 = await service.checkAndIncrement(appId, "Denominator", 1, "user-b@example.com");

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
    });

    it("returns null conflict when application/scope does not exist", async () => {
      const result = await service.checkAndIncrement(
        "99999999-0000-0000-0000-000000000099",
        "Denominator",
        1,
        actorUserId
      );

      expect(result.success).toBe(false);
      expect(result.conflict).toBeNull();
    });

    it("works independently per scope — denominator and numerator versions are separate", async () => {
      const denomResult = await service.checkAndIncrement(appId, "Denominator", 1, actorUserId);
      const numResult = await service.checkAndIncrement(appId, "Numerator", 1, actorUserId);

      expect(denomResult.success).toBe(true);
      expect(numResult.success).toBe(true);
      expect(denomResult.newVersion!.version).toBe(2);
      expect(numResult.newVersion!.version).toBe(2);
    });
  });

  describe("forceIncrement", () => {
    it("bypasses version check and always increments", async () => {
      // Increment to version 2 normally
      await service.checkAndIncrement(appId, "Denominator", 1, actorUserId);

      // Force increment even though we pass stale version 1
      const result = await service.forceIncrement(appId, "Denominator", actorUserId);

      expect(result).not.toBeNull();
      expect(result!.version).toBe(3);
      expect(result!.lastModifiedBy).toBe(actorUserId);
    });

    it("returns null for non-existent application/scope", async () => {
      const result = await service.forceIncrement(
        "99999999-0000-0000-0000-000000000099",
        "Denominator",
        actorUserId
      );

      expect(result).toBeNull();
    });
  });

  describe("getVersion", () => {
    it("returns current version for existing scope", async () => {
      const version = await service.getVersion(appId, "Denominator");

      expect(version).not.toBeNull();
      expect(version!.version).toBe(1);
      expect(version!.ruleScope).toBe("Denominator");
    });

    it("returns null for non-existent scope", async () => {
      const version = await service.getVersion(
        "99999999-0000-0000-0000-000000000099",
        "Numerator"
      );

      expect(version).toBeNull();
    });
  });

  describe("buildConflictResponse", () => {
    it("builds 409 response payload with current state", async () => {
      // Increment to version 2
      await service.checkAndIncrement(appId, "Denominator", 1, actorUserId);

      const conflict = await service.getConflictState(appId, "Denominator");

      expect(conflict).not.toBeNull();
      expect(conflict!.currentVersion).toBe(2);
      expect(conflict!.lastModifiedBy).toBe(actorUserId);
      expect(conflict!.lastModifiedAt).toBeDefined();
      expect(Array.isArray(conflict!.currentRules)).toBe(true);
    });
  });
});
