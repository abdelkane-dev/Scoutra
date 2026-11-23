import { describe, expect, it } from 'vitest';
import {
  PROSPECTING_MODELS,
  PROSPECT_KINDS,
  isIsoCountry,
  isoCountrySchema,
  prospectingModelSchema,
} from '../src';

describe('référentiels', () => {
  it('codes de modèles uniques, snake_case, types connus', () => {
    const codes = PROSPECTING_MODELS.map((m) => m.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const m of PROSPECTING_MODELS) {
      expect(m.code).toMatch(/^[a-z0-9]+(_[a-z0-9]+)*$/);
      for (const k of m.defaultKinds) expect(PROSPECT_KINDS).toContain(k);
    }
    expect(codes).toEqual(
      expect.arrayContaining(['b2b', 'b2c', 'b2g', 'g2b', 'procurement_sourcing']),
    );
    expect(prospectingModelSchema.safeParse('inconnu').success).toBe(false);
  });

  it('codes pays ISO', () => {
    expect(isIsoCountry('ML')).toBe(true);
    expect(isIsoCountry('SN')).toBe(true);
    expect(isIsoCountry('FR')).toBe(true);
    expect(isIsoCountry('ZZ')).toBe(false);
    expect(isIsoCountry('XK')).toBe(false);
    expect(isIsoCountry('ml')).toBe(false);
    expect(isoCountrySchema.parse(' ml ')).toBe('ML');
  });
});

describe('profil d’organisation', async () => {
  const { orgProfileSchema, SECTORS, ACCOUNT_TYPES } = await import('../src');
  it('codes uniques, libellés FR/EN, validation stricte', () => {
    expect(new Set(SECTORS.map((s) => s.code)).size).toBe(SECTORS.length);
    expect(new Set(ACCOUNT_TYPES.map((s) => s.code)).size).toBe(ACCOUNT_TYPES.length);
    expect(
      orgProfileSchema.parse({ accountType: 'startup', sectors: ['j_tech_media', 'j_tech_media'] }),
    ).toEqual({ accountType: 'startup', sectors: ['j_tech_media'] });
    expect(
      orgProfileSchema.safeParse({ accountType: 'x', sectors: ['j_tech_media'] }).success,
    ).toBe(false);
    expect(orgProfileSchema.safeParse({ accountType: 'sme', sectors: [] }).success).toBe(false);
    expect(
      orgProfileSchema.safeParse({
        accountType: 'sme',
        sectors: ['f_construction'],
        countryCode: 'FR',
      }).success,
    ).toBe(false);
  });
});

describe('profil : site web de l’expéditeur', async () => {
  const { orgProfileSchema } = await import('../src');
  it('normalisé en domaine ; null pour effacer ; invalide refusé', () => {
    const base = { accountType: 'sme', sectors: ['f_construction'] };
    expect(orgProfileSchema.parse({ ...base, website: 'https://www.Acme.sn/offre' }).website).toBe(
      'acme.sn',
    );
    expect(orgProfileSchema.parse({ ...base, website: null }).website).toBeNull();
    expect(orgProfileSchema.parse(base).website).toBeUndefined();
    expect(orgProfileSchema.safeParse({ ...base, website: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(orgProfileSchema.safeParse({ ...base, website: 'https://u:p@x.sn' }).success).toBe(
      false,
    );
  });
});
