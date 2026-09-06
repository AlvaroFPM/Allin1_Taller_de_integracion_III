import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintPluginPrettierRecommended,
  {
    rules: {
      // Desactivar regla base de JS y usar la de TypeScript que entiende tipos
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      
      // console.log no va en producción; console.warn y error se permiten
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      
      // Componentes sin children deben usar self-closing: <Component />
      "react/self-closing-comp": "warn",
      
      // Integración con Prettier: forzar regla de saltos de línea LF
      "prettier/prettier": ["error", { "endOfLine": "lf" }]
    }
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
