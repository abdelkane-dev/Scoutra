/** Modèles de prospection suggérés selon le profil de l'organisation (type de compte, secteurs). */
const BY_ACCOUNT: Record<string, string[]> = {
  individual: ['c2c', 'c2b', 'local_business', 'real_estate'],
  freelancer: ['c2b', 'b2b', 'local_business', 'events_exhibitors'],
  sme: ['b2b', 'partners_distributors', 'local_business', 'procurement_sourcing'],
  startup: ['b2b', 'investors_fundraising', 'talent_recruiting', 'partners_distributors'],
  enterprise: ['b2b', 'partners_distributors', 'procurement_sourcing', 'b2g'],
  nonprofit: ['b2n', 'investors_fundraising', 'press_pr', 'b2g'],
  public_sector: ['g2b', 'procurement_sourcing', 'b2n', 'education_institutions'],
  agency: ['b2b', 'local_business', 'c2b', 'press_pr'],
};
const BY_SECTOR: Record<string, string> = {
  l_real_estate: 'real_estate',
  q_health: 'regulated_professions',
  p_education: 'education_institutions',
  g_trade: 'marketplace_sellers',
  c_manufacturing: 'partners_distributors',
  o_public_admin: 'b2g',
  r_arts_recreation: 'events_exhibitors',
};

export function suggestModels(accountType: string | null, sectors: string[], n = 4): string[] {
  const out = [...(BY_ACCOUNT[accountType ?? ''] ?? ['b2b', 'b2c', 'partners_distributors', 'local_business'])];
  for (const s of sectors) {
    const m = BY_SECTOR[s];
    if (m && !out.includes(m)) out.unshift(m);
  }
  return out.slice(0, n);
}
