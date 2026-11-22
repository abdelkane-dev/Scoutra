import { describe, expect, it } from 'vitest';
import { PROSPECTING_MODELS, PROSPECT_KINDS } from '@scoutra/core';
import { messages, negotiateLocale, t } from '../src';

function keys(o: object, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v as object, `${prefix}${k}.`),
  );
}

describe('i18n', () => {
  it('FR et EN ont exactement les mêmes clés', () => {
    expect(keys(messages.en).sort()).toEqual(keys(messages.fr).sort());
  });
  it('chaque modèle de prospection et type d’entité a un libellé', () => {
    for (const m of PROSPECTING_MODELS)
      expect(messages.fr.prospectingModels).toHaveProperty(m.code);
    for (const k of PROSPECT_KINDS) expect(messages.en.prospectKinds).toHaveProperty(k);
  });
  it('négociation', () => {
    expect(negotiateLocale('en-US,en;q=0.9,fr;q=0.8')).toBe('en');
    expect(negotiateLocale('de-DE,fr;q=0.5')).toBe('fr');
    expect(negotiateLocale('de-DE')).toBe('fr');
    expect(negotiateLocale('en', 'fr')).toBe('fr');
    expect(negotiateLocale(null, 'xx')).toBe('fr');
  });
  it('traduction', () => {
    expect(t('en', 'roles.owner')).toBe('Owner');
    expect(t('fr', 'errors.forbidden')).toMatch(/droits/);
  });
});
