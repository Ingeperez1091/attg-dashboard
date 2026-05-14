import { describe, expect, it, vi } from "vitest";
import { NumeratorFilterDbRepository } from "@/infrastructure/persistence/database/NumeratorFilterDbRepository";
import { SqlClient } from "@/lib/db/sql-client";

describe("integration - numerator filter SQL repository", () => {
  it("maps SQL bit fields returned as booleans", async () => {
    const query = vi.fn<SqlClient["query"]>().mockResolvedValue({
      rows: [
        {
          ApplicationModelFieldId: "field-1",
          ApplicationId: "app-1",
          FieldName: "Revenue",
          FieldType: "numeric",
          IsFilterable: true,
          IsMetricDimension: false,
          DisplayOrder: 1
        },
        {
          ApplicationModelFieldId: "field-2",
          ApplicationId: "app-1",
          FieldName: "Notes",
          FieldType: "text",
          IsFilterable: false,
          IsMetricDimension: false,
          DisplayOrder: 2
        }
      ]
    });

    const repository = new NumeratorFilterDbRepository({ query });

    const fields = await repository.getModelByApplicationId("app-1");

    expect(fields).toEqual([
      {
        applicationModelFieldId: "field-1",
        applicationId: "app-1",
        fieldName: "Revenue",
        fieldType: "numeric",
        isFilterable: true,
        isMetricDimension: false,
        displayOrder: 1
      },
      {
        applicationModelFieldId: "field-2",
        applicationId: "app-1",
        fieldName: "Notes",
        fieldType: "text",
        isFilterable: false,
        isMetricDimension: false,
        displayOrder: 2
      }
    ]);
  });
});