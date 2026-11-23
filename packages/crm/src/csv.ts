/**
 * CSV sûr pour les tableurs (revue : injection de formules) : toute cellule commençant par
 * = + - @ tabulation ou retour chariot est préfixée d'une apostrophe ; guillemets doublés ;
 * séparateur virgule, fin de ligne CRLF, BOM UTF-8 pour Excel.
 */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s =
    typeof v === 'string'
      ? v
      : typeof v === 'number' || typeof v === 'boolean'
        ? String(v)
        : v instanceof Date
          ? v.toISOString()
          : JSON.stringify(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n']/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return `﻿${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
