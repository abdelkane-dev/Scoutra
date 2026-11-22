/**
 * Génère src/rules.generated.ts à partir des règles YAML versionnées (rules/*.yaml).
 * Les règles sont embarquées dans le code (pas de lecture de fichier à l'exécution : le worker
 * est empaqueté). Un test vérifie que le fichier généré correspond aux YAML.
 * Usage : pnpm --filter @scoutra/compliance rules
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { rulesetSchema } from '../src/schema';

const dir = fileURLToPath(new URL('../rules/', import.meta.url));
export function loadYamlRules() {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => rulesetSchema.parse(load(readFileSync(dir + f, 'utf8'))));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = `// FICHIER GÉNÉRÉ par scripts/build-rules.ts depuis rules/*.yaml — ne pas modifier à la main.\nimport type { Ruleset } from './schema';\n\nexport const RULESETS: readonly Ruleset[] = ${JSON.stringify(loadYamlRules(), null, 2)};\n`;
  writeFileSync(fileURLToPath(new URL('../src/rules.generated.ts', import.meta.url)), out);
  console.info('règles générées');
}
