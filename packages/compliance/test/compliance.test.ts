import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { CONTACT_CHANNELS } from '@scoutra/core';
import { RULESETS, allowedChannels, evaluate, legalFooter, rulesetSchema } from '../src';

const dir = fileURLToPath(new URL('../rules/', import.meta.url));

describe('règles pays (YAML versionné)', () => {
  it('le fichier généré correspond exactement aux YAML (lancer `pnpm --filter @scoutra/compliance rules`)', () => {
    const yaml = readdirSync(dir)
      .filter((f) => f.endsWith('.yaml'))
      .sort()
      .map((f) => rulesetSchema.parse(load(readFileSync(dir + f, 'utf8'))));
    expect(RULESETS).toEqual(yaml);
  });
});

describe('garde-fou juridique', () => {
  const b2b = { senderCountry: 'SN', audience: 'business' as const };
  it('UE : B2B email permis avec opposition et mention ; particulier sans consentement refusé', () => {
    const d = evaluate({ ...b2b, recipientCountry: 'FR', channel: 'email' });
    expect(d.outcome).toBe('allow_with_conditions');
    expect(d.conditions).toMatchObject({ requireOptOut: true, footer: 'eu_notice' });
    expect(d.rulesetVersions).toContain('EU@2026-11-22');
    const p = evaluate({
      ...b2b,
      audience: 'individual',
      recipientCountry: 'FR',
      channel: 'email',
    });
    expect(p.outcome).toBe('deny');
    expect(p.reasons).toContain('consent_required');
    const c = evaluate({
      ...b2b,
      audience: 'individual',
      recipientCountry: 'FR',
      channel: 'email',
      legalBasis: 'consent',
      consentProof: true,
    });
    expect(c.outcome).toBe('allow_with_conditions');
  });
  it('États-Unis : SMS/appel vers un particulier refusé sans consentement (TCPA)', () => {
    expect(
      evaluate({ ...b2b, audience: 'individual', recipientCountry: 'US', channel: 'phone' })
        .outcome,
    ).toBe('deny');
  });
  it('page publique (réseau, formulaire) : ouverture manuelle seulement, jamais d’envoi automatique', () => {
    expect(
      evaluate({ ...b2b, audience: 'individual', recipientCountry: 'CI', channel: 'social_page' })
        .outcome,
    ).toBe('manual_only');
  });
  it('pays non couvert : règle prudente + avertissement', () => {
    const d = evaluate({ ...b2b, recipientCountry: 'JP', channel: 'email' });
    expect(d.warnings).toEqual(['country_not_covered']);
    expect(d.outcome).toBe('allow_with_conditions');
    expect(
      evaluate({ ...b2b, audience: 'individual', recipientCountry: 'JP', channel: 'phone' })
        .outcome,
    ).toBe('deny');
  });
  it('la règle la plus stricte l’emporte (émetteur UE vers CEDEAO, WhatsApp B2B)', () => {
    expect(
      evaluate({
        senderCountry: 'SN',
        audience: 'business',
        recipientCountry: 'CI',
        channel: 'whatsapp',
      }).outcome,
    ).toBe('allow_with_conditions');
    expect(
      evaluate({
        senderCountry: 'FR',
        audience: 'business',
        recipientCountry: 'CI',
        channel: 'whatsapp',
      }).outcome,
    ).toBe('deny');
  });
  it('propriété : un particulier sans consentement n’est jamais joignable en direct', () => {
    const countries = ['FR', 'GB', 'US', 'CA', 'SN', 'ML', 'CI', 'NG', 'JP', 'BR', 'DE'];
    fc.assert(
      fc.property(
        fc.constantFrom(...countries),
        fc.constantFrom(...countries),
        fc.constantFrom('email', 'phone', 'whatsapp'),
        (r, s, ch) => {
          const d = evaluate({
            recipientCountry: r,
            senderCountry: s,
            audience: 'individual',
            channel: ch as 'email',
          });
          expect(d.outcome).toBe('deny');
        },
      ),
    );
  });
  it('canaux proposables : refusés retirés', () => {
    const list = allowedChannels(
      { ...b2b, audience: 'individual', recipientCountry: 'FR' },
      CONTACT_CHANNELS,
    );
    expect(list.map((c) => c.channel).sort()).toEqual(['social_page', 'website_form']);
  });
  it('pied de page légal par le code', () => {
    const f = legalFooter('eu_notice', 'fr', { name: 'Acme' });
    expect(f).toContain('Acme');
    expect(f).toContain('STOP');
    expect(legalFooter(undefined, 'en', { name: 'A' })).toBe('');
  });
});
