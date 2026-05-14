import { beforeEach, describe, expect, it } from "vitest";
import { PUT } from "@/app/api/filters/denominator/[appId]/route";
import {
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("integration - operator type enforcement by field type", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  describe("text fields", () => {
    // EngagementServiceCode (0007): text, filterable
    const textFieldId = "50000000-0000-0000-0007-000000000000";

    it.each([
      ["EQUALS", "11300", true],
      ["NOT_EQUALS", "11300", true],
      ["CONTAINS", "Tax", true],
      ["NOT_CONTAINS", "Tax", true],
      ["IN_LIST", "11300;11400", true],
      ["NOT_IN_LIST", "11300;11400", true],
      ["GREATER_THAN", "11300", false],
      ["GREATER_OR_EQUAL", "11300", false],
      ["LESS_THAN", "11300", false],
      ["LESS_OR_EQUAL", "11300", false]
    ])("operator %s on text field is %s (valid=%s)", async (operator, value, shouldSucceed) => {
      const response = await PUT(
        new Request(`http://localhost/api/filters/denominator/${appId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rules: [{ denominatorModelId: textFieldId, operator, value }]
          })
        }),
        { params: Promise.resolve({ appId }) }
      );

      expect(response.status).toBe(shouldSucceed ? 200 : 400);
    });
  });

  describe("numeric fields", () => {
    // ETD_ANSRAmt (000C): numeric, filterable
    const numericFieldId = "50000000-0000-0000-000C-000000000000";

    it.each([
      ["EQUALS", "5000", true],
      ["NOT_EQUALS", "5000", true],
      ["GREATER_THAN", "5000", true],
      ["GREATER_OR_EQUAL", "5000", true],
      ["LESS_THAN", "5000", true],
      ["LESS_OR_EQUAL", "5000", true],
      ["CONTAINS", "5000", false],
      ["NOT_CONTAINS", "5000", false],
      ["IN_LIST", "5000;6000", false],
      ["NOT_IN_LIST", "5000;6000", false]
    ])("operator %s on numeric field is valid=%s", async (operator, value, shouldSucceed) => {
      const response = await PUT(
        new Request(`http://localhost/api/filters/denominator/${appId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rules: [{ denominatorModelId: numericFieldId, operator, value }]
          })
        }),
        { params: Promise.resolve({ appId }) }
      );

      expect(response.status).toBe(shouldSucceed ? 200 : 400);
    });
  });

  describe("date fields", () => {
    // CreationDate (000A): date, filterable
    const dateFieldId = "50000000-0000-0000-000A-000000000000";

    it.each([
      ["EQUALS", "2025-01-01", true],
      ["GREATER_THAN", "2025-01-01", true],
      ["GREATER_OR_EQUAL", "2025-01-01", true],
      ["LESS_THAN", "2025-01-01", true],
      ["LESS_OR_EQUAL", "2025-01-01", true],
      ["CONTAINS", "2025-01-01", false],
      ["NOT_CONTAINS", "2025-01-01", false],
      ["IN_LIST", "2025-01-01;2025-12-31", false],
      ["NOT_IN_LIST", "2025-01-01;2025-12-31", false]
    ])("operator %s on date field is valid=%s", async (operator, value, shouldSucceed) => {
      const response = await PUT(
        new Request(`http://localhost/api/filters/denominator/${appId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rules: [{ denominatorModelId: dateFieldId, operator, value }]
          })
        }),
        { params: Promise.resolve({ appId }) }
      );

      expect(response.status).toBe(shouldSucceed ? 200 : 400);
    });
  });
});
