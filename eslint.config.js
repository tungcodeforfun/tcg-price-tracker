import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["**/build", "**/.react-router", "**/node_modules", "packages/db/migrations"]),
  {
    files: ["**/*.{ts,tsx,js}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["apps/web/app/**/*.{ts,tsx}"],
    ignores: ["apps/web/app/.server/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@tcg/core",
              message:
                "Import from ~/.server/catalog so client bundles can't pull in the database layer.",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
]);
