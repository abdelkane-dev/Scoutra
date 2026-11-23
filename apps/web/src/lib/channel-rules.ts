/**
 * Résumé indicatif des canaux autorisés par zone (démonstration de l'interface).
 * Besoin d'API : GET /api/compliance/rules?country= (règles maintenues côté serveur, @scoutra/compliance).
 */
const EU = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
];

export type Ch = 'email' | 'phone' | 'whatsapp' | 'linkedin_manual';

export function allowedChannels(cc: string, kind: 'company' | 'person'): Ch[] {
  if (kind === 'company') return ['email', 'phone', 'whatsapp', 'linkedin_manual'];
  if (EU.includes(cc) || cc === 'GB' || cc === 'CH') return ['phone', 'linkedin_manual'];
  if (cc === 'US' || cc === 'CA') return ['email', 'linkedin_manual'];
  return ['email', 'phone', 'linkedin_manual'];
}

export function zoneOf(cc: string): 'eu' | 'uk' | 'us' | 'ca' | 'other' {
  if (EU.includes(cc)) return 'eu';
  if (cc === 'GB') return 'uk';
  if (cc === 'US') return 'us';
  if (cc === 'CA') return 'ca';
  return 'other';
}
