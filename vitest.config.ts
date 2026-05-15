import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  oxc: {
    jsx: { runtime: "automatic" }
  },
  test: {
    include: [
      "tests/contract/user-administration/**/*.test.ts",
      "tests/contract/numerator-ingestion/**/*.test.ts",
      "tests/contract/filters/**/*.test.ts",
      "tests/contract/authentication-authorization/**/*.test.ts",
      "tests/contract/validation-pipeline/**/*.test.ts",
      "tests/contract/metrics/**/*.test.ts",
      "tests/integration/user-administration/**/*.test.ts",
      "tests/integration/numerator-ingestion/**/*.test.ts",
      "tests/integration/filters/**/*.test.ts",
      "tests/integration/authentication-authorization/**/*.test.ts",
      "tests/integration/validation-pipeline/**/*.test.ts",
      "tests/integration/metrics/**/*.test.ts",
      "tests/unit/**/*.test.ts"
    ],
    environment: "node",
    globals: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      include: [
        "src/frontend/app/api/admin/users/**/*.ts",
        "src/frontend/app/api/numerator/**/*.ts",
        "src/frontend/core/application/services/numeratorIngestionService.ts",
        "src/frontend/infrastructure/persistence/database/sqlNumeratorIngestionRepository.ts",
        "src/frontend/infrastructure/persistence/memory/inMemoryNumeratorIngestionRepository.ts",
        "src/frontend/infrastructure/persistence/runtime/numeratorIngestionRepositoryFactory.ts",
        "src/frontend/lib/api/**/*.ts",
        "src/frontend/lib/auth/**/*.ts",
        "src/frontend/lib/config/**/*.ts",
        "src/frontend/lib/repositories/**/*.ts",
        "src/frontend/lib/validation/**/*.ts"
      ],
      exclude: [
        "**/*.d.ts",
        "src/frontend/lib/repositories/types.ts"
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/frontend")
    }
  }
});
