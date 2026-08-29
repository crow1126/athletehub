import nextPlugin from "@next/eslint-plugin-next";
import js from "@eslint/js";
import globals from "globals";

export default [
  // Global ignores MUST be standalone in ESLint 9
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "node_modules/**",
      "electron/**",
      "supabase/**",
      "scripts/**",
      "android/**",
      "ios/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
      "proxy.js",
    ],
  },
  // Base JS & Next.js config for all app source files
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    ...js.configs.recommended,
    plugins: {
      "@next/next": nextPlugin,
    },
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "no-undef": "off",
      "no-empty": ["error", { "allowEmptyCatch": true }],
    },
  },
];
