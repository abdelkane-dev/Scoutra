import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/next-env.d.ts',
      'docs/**',
      'packages/db/migrations/**',
      'apps/web/src/app/(marketing)/**',
      'apps/web/src/app/(app)/**',
      'apps/web/src/components/**',
      'packages/ui/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'sql',
          property: 'raw',
          message: 'sql.raw est interdit : utiliser des paramètres (T44).',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'HTML brut interdit (E8) : assainir et rendre en texte.',
        },
      ],
    },
  },
  {
    // Seul packages/db parle directement à Postgres (couche d'accès unique, RLS).
    files: ['apps/**/*.{ts,tsx}', 'packages/!(db)/**/*.ts', 'tools/**/*.ts'],
    ignores: ['packages/auth/**', 'packages/queue/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'pg', message: 'Passer par @scoutra/db (withTenant).' },
            { name: 'drizzle-orm', message: 'Passer par @scoutra/db (withTenant).' },
          ],
          patterns: [{ group: ['drizzle-orm/*'], message: 'Passer par @scoutra/db (withTenant).' }],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  prettier,
);
