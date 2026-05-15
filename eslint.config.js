import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: [
      "node_modules/**",
      "src/frontend/node_modules/**",
      "src/frontend/.next/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "**/*.min.js"
    ]
  },
  {
    files: ["src/frontend/**/*.ts", "src/frontend/**/*.tsx", "tests/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module"
    },
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ]
    }
  }
];
