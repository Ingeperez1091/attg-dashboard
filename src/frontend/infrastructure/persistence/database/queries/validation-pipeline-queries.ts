import { executeParameterizedQuery, SqlClient } from "@/lib/db/sql-client";

const CANONICAL_OPERATORS = new Set([
  "EQUALS",
  "NOT_EQUALS",
  "CONTAINS",
  "NOT_CONTAINS",
  "IN_LIST",
  "NOT_IN_LIST",
  "GREATER_THAN",
  "GREATER_OR_EQUAL",
  "LESS_THAN",
  "LESS_OR_EQUAL"
]);

export type PipelineRunRow = {
  RunId: string;
  ApplicationId: string;
  Status: "Queued" | "Processing" | "Completed" | "Failed";
  TriggerSource: "API" | "ADF" | "Manual";
  StartTime: string | null;
  EndTime: string | null;
  TotalRecordsIn: number | null;
  ValidCount: number | null;
  InvalidCount: number | null;
  DuplicateCount: number | null;
  FilteredOutCount: number | null;
  MatchedCount: number | null;
  ErrorMessage: string | null;
  SnapshotDate: string | null;
  CreatedBy: string;
  UpdatedBy: string;
  CreateDate: string;
  UpdateDate: string;
};

export type ValidationResultRow = {
  ResultId: string;
  PipelineRunId: string;
  ApplicationId: string;
  StageId: string;
  RecordKey: string | null;
  Status: "Valid" | "Invalid" | "Duplicate" | "FilteredOut";
  ErrorMessage: string | null;
  CreatedBy: string;
  UpdatedBy: string;
  CreateDate: string;
  UpdateDate: string;
};

export type MatchedRecordRow = {
  MatchedId: string;
  PipelineRunId: string;
  ApplicationId: string;
  NumeratorKey: string;
  DenominatorKey: string;
  RevenueAmount: number | null;
  StageId: string | null;
  CreatedBy: string;
  UpdatedBy: string;
  CreateDate: string;
  UpdateDate: string;
};

export function assertCanonicalOperator(operator: string): void {
  if (!CANONICAL_OPERATORS.has(operator)) {
    throw new Error(`Unsupported denominator operator: ${operator}`);
  }
}

export async function insertPipelineRun(
  client: SqlClient,
  params: { runId: string; applicationId: string; triggerSource: string; actorUserId: string }
): Promise<PipelineRunRow | null> {
  const result = await executeParameterizedQuery<PipelineRunRow>(
    client,
    `
      INSERT INTO app.PipelineRuns
      (RunId, ApplicationId, Status, TriggerSource, CreatedBy, UpdatedBy, CreateDate, UpdateDate)
      VALUES
      (@runId, @applicationId, 'Queued', @triggerSource, @actorUserId, @actorUserId, SYSUTCDATETIME(), SYSUTCDATETIME());

      SELECT TOP 1 *
      FROM app.PipelineRuns
      WHERE RunId = @runId;
    `,
    params
  );

  return result.rows[0] ?? null;
}

export async function selectPipelineRunById(client: SqlClient, runId: string): Promise<PipelineRunRow | null> {
  const result = await executeParameterizedQuery<PipelineRunRow>(
    client,
    `
      SELECT TOP 1 *
      FROM app.PipelineRuns
      WHERE RunId = @runId;
    `,
    { runId }
  );

  return result.rows[0] ?? null;
}

export async function updatePipelineRunStatus(
  client: SqlClient,
  params: {
    runId: string;
    status: string;
    actorUserId: string;
    startTime: string | null;
    endTime: string | null;
    errorMessage: string | null;
  }
): Promise<void> {
  await executeParameterizedQuery(
    client,
    `
      UPDATE app.PipelineRuns
      SET Status = @status,
          StartTime = COALESCE(@startTime, StartTime),
          EndTime = @endTime,
          ErrorMessage = @errorMessage,
          UpdateDate = SYSUTCDATETIME(),
          UpdatedBy = @actorUserId
      WHERE RunId = @runId;
    `,
    params
  );
}

export async function updateRunCounts(
  client: SqlClient,
  params: {
    runId: string;
    actorUserId: string;
    totalRecordsIn: number | null;
    validCount: number | null;
    invalidCount: number | null;
    duplicateCount: number | null;
    filteredOutCount: number | null;
    matchedCount: number | null;
  }
): Promise<void> {
  await executeParameterizedQuery(
    client,
    `
      UPDATE app.PipelineRuns
      SET TotalRecordsIn = COALESCE(@totalRecordsIn, TotalRecordsIn),
          ValidCount = COALESCE(@validCount, ValidCount),
          InvalidCount = COALESCE(@invalidCount, InvalidCount),
          DuplicateCount = COALESCE(@duplicateCount, DuplicateCount),
          FilteredOutCount = COALESCE(@filteredOutCount, FilteredOutCount),
          MatchedCount = COALESCE(@matchedCount, MatchedCount),
          UpdateDate = SYSUTCDATETIME(),
          UpdatedBy = @actorUserId
      WHERE RunId = @runId;
    `,
    params
  );
}

export async function setPipelineRunSnapshotDate(
  client: SqlClient,
  params: { runId: string; actorUserId: string; snapshotDate: string }
): Promise<void> {
  await executeParameterizedQuery(
    client,
    `
      UPDATE app.PipelineRuns
      SET SnapshotDate = @snapshotDate,
          UpdateDate = SYSUTCDATETIME(),
          UpdatedBy = @actorUserId
      WHERE RunId = @runId;
    `,
    params
  );
}

export async function selectValidationResultsPage(
  client: SqlClient,
  query: {
    applicationId: string;
    runId?: string;
    status?: "Valid" | "Invalid" | "Duplicate" | "FilteredOut";
    page: number;
    pageSize: number;
  }
): Promise<{ items: ValidationResultRow[]; total: number; page: number; pageSize: number }> {
  const offset = (query.page - 1) * query.pageSize;

  const totalResult = await executeParameterizedQuery<{ TotalCount: number }>(
    client,
    `
      SELECT COUNT(1) AS TotalCount
      FROM app.ValidationResults
      WHERE ApplicationId = @applicationId
        AND (@runId IS NULL OR PipelineRunId = @runId)
        AND (@status IS NULL OR Status = @status);
    `,
    {
      applicationId: query.applicationId,
      runId: query.runId ?? null,
      status: query.status ?? null
    }
  );

  const rowsResult = await executeParameterizedQuery<ValidationResultRow>(
    client,
    `
      SELECT
        ResultId,
        PipelineRunId,
        ApplicationId,
        StageId,
        RecordKey,
        Status,
        ErrorMessage,
        CreatedBy,
        UpdatedBy,
        CreateDate,
        UpdateDate
      FROM app.ValidationResults
      WHERE ApplicationId = @applicationId
        AND (@runId IS NULL OR PipelineRunId = @runId)
        AND (@status IS NULL OR Status = @status)
      ORDER BY CreateDate DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
    `,
    {
      applicationId: query.applicationId,
      runId: query.runId ?? null,
      status: query.status ?? null,
      offset,
      pageSize: query.pageSize
    }
  );

  return {
    items: rowsResult.rows,
    total: totalResult.rows[0]?.TotalCount ?? 0,
    page: query.page,
    pageSize: query.pageSize
  };
}

export async function upsertMatchedRecords(
  client: SqlClient,
  items: Array<{
    matchedId: string;
    pipelineRunId: string;
    applicationId: string;
    numeratorKey: string;
    denominatorKey: string;
    revenueAmount: number | null;
    stageId: string | null;
    actorUserId: string;
  }>
): Promise<void> {
  for (const item of items) {
    await executeParameterizedQuery(
      client,
      `
        MERGE app.MatchedRecords AS target
        USING (
          SELECT
            @matchedId AS MatchedId,
            @pipelineRunId AS PipelineRunId,
            @applicationId AS ApplicationId,
            @numeratorKey AS NumeratorKey,
            @denominatorKey AS DenominatorKey,
            @revenueAmount AS RevenueAmount,
            @stageId AS StageId,
            @actorUserId AS ActorUserId
        ) AS source
        ON target.MatchedId = source.MatchedId
        WHEN MATCHED THEN
          UPDATE SET
            target.PipelineRunId = source.PipelineRunId,
            target.ApplicationId = source.ApplicationId,
            target.NumeratorKey = source.NumeratorKey,
            target.DenominatorKey = source.DenominatorKey,
            target.RevenueAmount = source.RevenueAmount,
            target.StageId = source.StageId,
            target.UpdateDate = SYSUTCDATETIME(),
            target.UpdatedBy = source.ActorUserId
        WHEN NOT MATCHED THEN
          INSERT
          (
            MatchedId,
            PipelineRunId,
            ApplicationId,
            NumeratorKey,
            DenominatorKey,
            RevenueAmount,
            StageId,
            CreateDate,
            CreatedBy,
            UpdateDate,
            UpdatedBy
          )
          VALUES
          (
            source.MatchedId,
            source.PipelineRunId,
            source.ApplicationId,
            source.NumeratorKey,
            source.DenominatorKey,
            source.RevenueAmount,
            source.StageId,
            SYSUTCDATETIME(),
            source.ActorUserId,
            SYSUTCDATETIME(),
            source.ActorUserId
          );
      `,
      item
    );
  }
}

export async function selectMatchedRecordsByRunId(client: SqlClient, runId: string): Promise<MatchedRecordRow[]> {
  const result = await executeParameterizedQuery<MatchedRecordRow>(
    client,
    `
      SELECT
        MatchedId,
        PipelineRunId,
        ApplicationId,
        NumeratorKey,
        DenominatorKey,
        RevenueAmount,
        StageId,
        CreatedBy,
        UpdatedBy,
        CreateDate,
        UpdateDate
      FROM app.MatchedRecords
      WHERE PipelineRunId = @runId
      ORDER BY CreateDate DESC;
    `,
    { runId }
  );

  return result.rows;
}
