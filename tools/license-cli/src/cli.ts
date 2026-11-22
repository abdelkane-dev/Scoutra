#!/usr/bin/env node
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  LICENSE_FEATURES,
  evaluateLicense,
  rawPublicKey,
  signLicense,
  type LicenseFeature,
} from '@scoutra/license';
import { assertOutsideGitRepo } from './paths';

const HELP = `scoutra-license — émission hors ligne des licences Scoutra

  keygen --kid <id> --out <dossier-hors-dépôt>
      Génère une paire Ed25519. La clé privée (<kid>.key, droits 600) n'est écrite
      QUE hors d'un dépôt Git. La clé publique est affichée : à ajouter dans
      packages/license/src/keys.ts (EMBEDDED_PUBLIC_KEYS).

  sign --key <fichier.key> --kid <id> --org <nom> --org-id <uuid> --country <ISO2>
       --max-users <n> --days <n> [--grace <jours=30>] [--features research,pipeline,byo_keys]
      Affiche le jeton de licence signé.

  verify --token <jeton> --kid <id> --pub <clé-publique-base64url> [--country <ISO2>]
      Vérifie un jeton hors ligne.
`;

function fail(msg: string): never {
  process.stderr.write(`Erreur : ${msg}\n`);
  process.exit(1);
}

function req(values: Record<string, unknown>, name: string): string {
  const v = values[name];
  if (typeof v !== 'string' || v.length === 0) fail(`--${name} est obligatoire`);
  return v;
}

function keygen(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: { kid: { type: 'string' }, out: { type: 'string' } },
  });
  const kid = req(values, 'kid');
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(kid)) fail('kid invalide');
  const out = req(values, 'out');
  assertOutsideGitRepo(out);
  mkdirSync(out, { recursive: true, mode: 0o700 });
  const keyPath = join(out, `${kid}.key`);
  if (existsSync(keyPath)) fail(`${keyPath} existe déjà (pas d'écrasement)`);
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), {
    mode: 0o600,
    flag: 'wx',
  });
  const pub = rawPublicKey(publicKey);
  writeFileSync(join(out, `${kid}.pub`), `${pub}\n`, { flag: 'wx' });
  process.stdout.write(`Clé privée : ${keyPath} (à garder hors ligne, sauvegarde chiffrée)\n`);
  process.stdout.write(`Clé publique (${kid}) : ${pub}\n`);
}

function signCmd(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      key: { type: 'string' },
      kid: { type: 'string' },
      org: { type: 'string' },
      'org-id': { type: 'string' },
      country: { type: 'string' },
      'max-users': { type: 'string' },
      days: { type: 'string' },
      grace: { type: 'string', default: '30' },
      features: { type: 'string', default: 'research,pipeline,byo_keys' },
    },
  });
  const features = req(values, 'features')
    .split(',')
    .map((f) => f.trim());
  for (const f of features)
    if (!(LICENSE_FEATURES as readonly string[]).includes(f))
      fail(`fonctionnalité inconnue : ${f}`);
  const now = Math.floor(Date.now() / 1000);
  const days = Number(req(values, 'days'));
  if (!Number.isInteger(days) || days < 1 || days > 3660) fail('--days invalide');
  const token = signLicense(
    {
      v: 1,
      lid: `lic_${randomBytes(12).toString('hex')}`,
      org: req(values, 'org'),
      orgId: req(values, 'org-id'),
      country: req(values, 'country').toUpperCase(),
      maxUsers: Number(req(values, 'max-users')),
      features: features as LicenseFeature[],
      iat: now,
      nbf: now,
      exp: now + days * 86_400,
      graceDays: Number(req(values, 'grace')),
      kid: req(values, 'kid'),
    },
    readFileSync(req(values, 'key'), 'utf8'),
  );
  process.stdout.write(`${token}\n`);
}

function verifyCmd(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      token: { type: 'string' },
      kid: { type: 'string' },
      pub: { type: 'string' },
      country: { type: 'string' },
    },
  });
  const ev = evaluateLicense(req(values, 'token'), {
    keyring: { [req(values, 'kid')]: req(values, 'pub') },
    now: Math.floor(Date.now() / 1000),
    ...(values.country ? { orgCountry: values.country } : {}),
  });
  process.stdout.write(
    `${JSON.stringify({ status: ev.status, reason: ev.reason, payload: ev.payload }, null, 2)}\n`,
  );
  if (ev.status === 'invalid') process.exit(2);
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === 'keygen') keygen(rest);
  else if (cmd === 'sign') signCmd(rest);
  else if (cmd === 'verify') verifyCmd(rest);
  else process.stdout.write(HELP);
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}
