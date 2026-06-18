import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";

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
      "@typescript-eslint": tsPlugin,
      "react": reactPlugin
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "react/no-danger": "error"
    }
  },
  {
    // Allow the single hardcoded dangerouslySetInnerHTML in RootLayout (THEME_INIT_SCRIPT).
    files: ["src/frontend/app/layout.tsx"],
    plugins: {
      "react": reactPlugin
    },
    rules: {
      "react/no-danger": "off"
    }
  }
];
