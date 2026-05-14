import * as fs from "node:fs";

type StoreAccessorOptions<T> = {
  storeFilePath?: string;
  globalKey: string;
  createEmptyStore: () => T;
  reviveStore?: (rawStore: T) => T;
};

type StoreAccessor<T> = {
  getStore: () => T;
  writeStore: (store: T) => void;
};

export function createStoreAccessor<T>(options: StoreAccessorOptions<T>): StoreAccessor<T> {
  function isSharedStoreEnabled(): boolean {
    return (process.env.NODE_ENV === "test" || process.env.PLAYWRIGHT_TEST === "true")
      && process.env.USE_INMEMORY_REPOSITORY === "true"
      && Boolean(options.storeFilePath);
  }

  function readSharedStore(): T {
    if (!options.storeFilePath) {
      return options.createEmptyStore();
    }

    if (!fs.existsSync(options.storeFilePath)) {
      const emptyStore = options.createEmptyStore();
      fs.writeFileSync(options.storeFilePath, JSON.stringify(emptyStore), "utf8");
      return emptyStore;
    }

    const rawStore = JSON.parse(fs.readFileSync(options.storeFilePath, "utf8")) as T;
    return options.reviveStore ? options.reviveStore(rawStore) : rawStore;
  }

  function writeStore(store: T): void {
    if (isSharedStoreEnabled() && options.storeFilePath) {
      fs.writeFileSync(options.storeFilePath, JSON.stringify(store), "utf8");
    }
  }

  function getStore(): T {
    if (isSharedStoreEnabled()) {
      return readSharedStore();
    }

    const globalStore = globalThis as typeof globalThis & Record<string, T | undefined>;
    if (!globalStore[options.globalKey]) {
      globalStore[options.globalKey] = options.createEmptyStore();
    }

    return globalStore[options.globalKey] as T;
  }

  return { getStore, writeStore };
}
