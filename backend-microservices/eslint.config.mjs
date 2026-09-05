// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Las variables no usadas son errores, excepto las que empiezan con '_' (convención para parámetros ignorados)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      
      // Los métodos deben declarar su tipo de retorno, pero permitimos inferencia en funciones flecha inline
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
      
      // Mantenemos como warning para que el equipo sepa dónde hay any, aunque no bloquee el pipeline
      '@typescript-eslint/no-explicit-any': 'warn',
      
      // Promesas sin await en el backend son bugs reales que pueden causar pérdida de contexto
      '@typescript-eslint/no-floating-promises': 'error',
      
      // Previene el paso de argumentos any a funciones fuertemente tipadas
      '@typescript-eslint/no-unsafe-argument': 'error',
      
      // console.log no debe ir a producción (usar logger del framework); console.warn y error se permiten
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      
      'prettier/prettier': ['error', { endOfLine: 'lf' }],
    },
  },
);
