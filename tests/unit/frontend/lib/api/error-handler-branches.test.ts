import { describe, expect, it } from "vitest";
import { AppError, toErrorBody, toStatusCode, assertCondition, toPublicContractError } from "@/lib/api/error-handler";

describe("error-handler - branch coverage", () => {
  describe("toErrorBody", () => {
    it("returns AppError fields when error is an AppError", () => {
      const result = toErrorBody(new AppError(400, "BAD_REQUEST", "Invalid input"), "req-1");
      expect(result).toEqual({ code: "BAD_REQUEST", message: "Invalid input", requestId: "req-1" });
    });

    it("returns generic error for non-AppError", () => {
      const result = toErrorBody(new Error("unexpected"), "req-2");
      expect(result).toEqual({ code: "INTERNAL_ERROR", message: "An unexpected error occurred.", requestId: "req-2" });
    });

    it("returns generic error for null", () => {
      const result = toErrorBody(null, "req-3");
      expect(result).toEqual({ code: "INTERNAL_ERROR", message: "An unexpected error occurred.", requestId: "req-3" });
    });
  });

  describe("toStatusCode", () => {
    it("returns AppError status when error is an AppError", () => {
      expect(toStatusCode(new AppError(403, "FORBIDDEN", "Nope"))).toBe(403);
    });

    it("returns 500 for non-AppError", () => {
      expect(toStatusCode("string error")).toBe(500);
    });
  });

  describe("assertCondition", () => {
    it("does not throw when condition is true", () => {
      expect(() => assertCondition(true, 400, "TEST", "msg")).not.toThrow();
    });

    it("throws AppError when condition is false", () => {
      expect(() => assertCondition(false, 409, "CONFLICT", "Already exists")).toThrow("Already exists");
    });
  });

  describe("toPublicContractError", () => {
    it("returns UNAUTHORIZED for 401 AppError", () => {
      const result = toPublicContractError(new AppError(401, "UNAUTHORIZED", "No active session."));
      expect(result).toEqual({ error: "UNAUTHORIZED", message: "No active session." });
    });

    it("returns FORBIDDEN for 403 AppError", () => {
      const result = toPublicContractError(new AppError(403, "FORBIDDEN", "No access."));
      expect(result).toEqual({ error: "FORBIDDEN", message: "Insufficient permissions." });
    });

    it("returns AppError code and message for other status codes", () => {
      const result = toPublicContractError(new AppError(400, "VALIDATION_ERROR", "Bad input"));
      expect(result).toEqual({ error: "VALIDATION_ERROR", message: "Bad input" });
    });

    it("returns generic error for non-AppError", () => {
      const result = toPublicContractError(new TypeError("oops"));
      expect(result).toEqual({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
    });
  });
});
