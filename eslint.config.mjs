import nextPlugin from "@next/eslint-plugin-next";
import js from "@eslint/js";
import globals from "globals";

export default [
  // Base JS recommended rules
  {
    ...js.configs.recommended,
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: {
        // Browser globals
        ...globals.browser,
        // Node.js globals (for API routes, lib files)
        ...globals.node,
        // ES2021 globals
        ...globals.es2021,
      },
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
  },
  // Next.js recommended rules
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // Relax some rules that generate false positives in Next.js
      "no-unused-vars": "warn",
      "no-undef": "off", // Next.js handles globals via TypeScript & env
    },
  },
  // Ignore build output and electron
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
      "*.config.js",
      "*.config.mjs",
      "proxy.js",
    ],
  },
];
