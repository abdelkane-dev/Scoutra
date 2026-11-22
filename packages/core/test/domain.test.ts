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
