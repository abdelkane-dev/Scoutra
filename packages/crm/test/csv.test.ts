import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '../src/csv';

describe('export CSV : neutralisation des formules', () => {
  it('cellules dangereuses préfixées ; guillemets doublés', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+33 1 23')).toBe(`"'+33 1 23"`);
    expect(csvCell('-2+3')).toBe(`"'-2+3"`);
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(csvCell('Société, SA')).toBe('"Société, SA"');
    expect(csvCell(null)).toBe('');
    expect(toCsv(['a'], [['x']])).toBe('﻿a\r\nx\r\n');
  });
  it('propriété : aucune cellule produite ne commence par un caractère de formule', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const c = csvCell(s).replace(/^"/, '');
        expect(/^[=+\-@\t\r]/.test(c)).toBe(false);
      }),
    );
  });
});
