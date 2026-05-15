import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/applications/[appId]/numeratormodel/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { resetRuntimeNumeratorFilterRepositoryForTests } from "@/infrastructure/persistence/runtime/repositories";
import { createRuntimeSqlClient } from "@/lib/db/runtime-sql-client";

const hasSqlEnv = Boolean(process.env.SQL_SERVER || process.env.SQL_DATABASE);
const sqlDescribe = hasSqlEnv ? describe : describe.skip;

describe("integration - application numerator model", () => {
  const appId = "10000000-0000-0000-0000-000000000005";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeNumeratorFilterRepositoryForTests();
  });

  it("returns active model fields including non-filterable entries", async () => {
    const response = await GET(new Request(`http://localhost/api/applications/${appId}/numeratormodel`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.applicationName).toBe("Navigate");
    expect(body.fields).toHaveLength(8);
    expect(body.fields[0].displayOrder).toBeLessThanOrEqual(body.fields[1].displayOrder);
    expect(body.fields.some((field: { isFilterable: boolean }) => field.isFilterable === false)).toBe(true);
  });
});

sqlDescribe("application model integration - seed idempotency", () => {
  it("returns stable row counts grouped by application after seed migration", async () => {
    const sqlClient = createRuntimeSqlClient();
    const result = await sqlClient.query<{
      ApplicationId: string;
      FieldCount: number;
      FilterableCount: number;
      MetricDimensionCount: number;
    }>(
      `
      SELECT
        ApplicationId,
        COUNT(*) AS FieldCount,
        SUM(CAST(IsFilterable AS INT)) AS FilterableCount,
        SUM(CAST(IsMetricDimension AS INT)) AS MetricDimensionCount
      FROM app.ApplicationModelFields
      WHERE IsActive = 1
      GROUP BY ApplicationId
      `,
      {}
    );

    expect(result.rows.length).toBe(5);

    const map = new Map(result.rows.map((row) => [row.ApplicationId, row]));
    expect(map.get("10000000-0000-0000-0000-000000000001")?.FieldCount).toBe(5);
    expect(map.get("10000000-0000-0000-0000-000000000001")?.FilterableCount).toBe(2);
    expect(map.get("10000000-0000-0000-0000-000000000001")?.MetricDimensionCount).toBe(1);

    expect(map.get("10000000-0000-0000-0000-000000000002")?.FieldCount).toBe(7);
    expect(map.get("10000000-0000-0000-0000-000000000002")?.FilterableCount).toBe(4);
    expect(map.get("10000000-0000-0000-0000-000000000002")?.MetricDimensionCount).toBe(1);

    expect(map.get("10000000-0000-0000-0000-000000000003")?.FieldCount).toBe(7);
    expect(map.get("10000000-0000-0000-0000-000000000003")?.FilterableCount).toBe(3);
    expect(map.get("10000000-0000-0000-0000-000000000003")?.MetricDimensionCount).toBe(1);

    expect(map.get("10000000-0000-0000-0000-000000000004")?.FieldCount).toBe(6);
    expect(map.get("10000000-0000-0000-0000-000000000004")?.FilterableCount).toBe(4);
    expect(map.get("10000000-0000-0000-0000-000000000004")?.MetricDimensionCount).toBe(1);

    expect(map.get("10000000-0000-0000-0000-000000000005")?.FieldCount).toBe(7);
    expect(map.get("10000000-0000-0000-0000-000000000005")?.FilterableCount).toBe(2);
    expect(map.get("10000000-0000-0000-0000-000000000005")?.MetricDimensionCount).toBe(1);
  });
});

