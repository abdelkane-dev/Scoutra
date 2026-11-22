import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertOutsideGitRepo } from '../src/paths';

describe('assertOutsideGitRepo', () => {
  it('refuse un dossier dans le dépôt', () => {
    expect(() => assertOutsideGitRepo(join(import.meta.dirname, 'keys'))).toThrow(/dépôt Git/);
  });
  it('accepte un dossier temporaire hors dépôt', () => {
    expect(() => assertOutsideGitRepo(mkdtempSync(join(tmpdir(), 'scoutra-keys-')))).not.toThrow();
  });
});
