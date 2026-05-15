import { randomUUID } from "node:crypto";
import {
  StageNumeratorPayloadInput,
  StageNumeratorPayloadResult
} from "@/core/domain/entities/NumeratorIngestion";
import { INumeratorIngestionRepository } from "@/core/domain/repositories/INumeratorIngestionRepository";
import { createStoreAccessor } from "@/infrastructure/persistence/memory/sharedStore";

type NumeratorIngestionRepoStore = {
  stagedRows: StageNumeratorPayloadResult[];
};

const sharedStoreFile = process.env.TEST_NUMERATOR_INGESTION_REPOSITORY_STORE_FILE;

const { getStore, writeStore } = createStoreAccessor<NumeratorIngestionRepoStore>({
  storeFilePath: sharedStoreFile,
  globalKey: "__dashboardNumeratorIngestionRepoStore",
  createEmptyStore: () => ({ stagedRows: [] })
});

export class NumeratorIngestionMemoryRepository implements INumeratorIngestionRepository {
  async stagePayload(input: StageNumeratorPayloadInput): Promise<StageNumeratorPayloadResult> {
    const store = getStore();
    const staged: StageNumeratorPayloadResult = {
      stageId: randomUUID(),
      applicationId: input.applicationId,
      payloadJson: input.payloadJson,
      createdBy: input.createdBy,
      createDate: new Date().toISOString()
    };

    store.stagedRows.push(staged);
    writeStore(store);
    return staged;
  }

  listStagedRowsForTests(): StageNumeratorPayloadResult[] {
    return [...getStore().stagedRows];
  }

  resetForTests(): void {
    const store = getStore();
    store.stagedRows.length = 0;
    writeStore(store);
  }
}
