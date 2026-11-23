import { z } from 'zod';

/**
 * Profil de l'organisation cliente (onboarding) : type de compte et secteurs d'activité.
 * Sert à suggérer et prioriser les playbooks. Modifiable par owner/admin (contrairement au pays).
 * Extensible : ajouter une entrée ici (TypeScript = source de vérité, pas d'enum Postgres).
 */
export const ACCOUNT_TYPES = [
  { code: 'individual', fr: 'Particulier', en: 'Individual' },
  { code: 'freelancer', fr: 'Indépendant / freelance', en: 'Freelancer / self-employed' },
  { code: 'sme', fr: 'PME', en: 'Small or medium business' },
  { code: 'startup', fr: 'Start-up', en: 'Startup' },
  { code: 'enterprise', fr: 'Grande entreprise / filiale', en: 'Enterprise / subsidiary' },
  { code: 'nonprofit', fr: 'Association / ONG', en: 'Nonprofit / NGO' },
  { code: 'public_sector', fr: 'Administration / secteur public', en: 'Public sector' },
  { code: 'agency', fr: 'Agence / cabinet', en: 'Agency / consultancy' },
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number]['code'];
export const ACCOUNT_TYPE_CODES = ACCOUNT_TYPES.map((a) => a.code) as [
  AccountType,
  ...AccountType[],
];
export const accountTypeSchema = z.enum(ACCOUNT_TYPE_CODES);

/**
 * Secteurs d'activité : sections de la CITI/ISIC Rév. 4 (Nations unies, niveau 1), proches des
 * secteurs NAICS à 2 chiffres. Code = lettre ISIC en minuscule + nom court stable.
 */
export const SECTORS = [
  {
    code: 'a_agriculture',
    isic: 'A',
    fr: 'Agriculture, sylviculture et pêche',
    en: 'Agriculture, forestry and fishing',
  },
  { code: 'b_mining', isic: 'B', fr: 'Industries extractives', en: 'Mining and quarrying' },
  { code: 'c_manufacturing', isic: 'C', fr: 'Industrie manufacturière', en: 'Manufacturing' },
  {
    code: 'd_energy',
    isic: 'D',
    fr: 'Énergie (électricité, gaz)',
    en: 'Electricity and gas supply',
  },
  {
    code: 'e_water_waste',
    isic: 'E',
    fr: 'Eau, assainissement, déchets',
    en: 'Water supply, sewerage and waste',
  },
  { code: 'f_construction', isic: 'F', fr: 'Construction / BTP', en: 'Construction' },
  { code: 'g_trade', isic: 'G', fr: 'Commerce (gros et détail)', en: 'Wholesale and retail trade' },
  {
    code: 'h_transport',
    isic: 'H',
    fr: 'Transport et logistique',
    en: 'Transportation and storage',
  },
  {
    code: 'i_hospitality',
    isic: 'I',
    fr: 'Hébergement et restauration',
    en: 'Accommodation and food service',
  },
  {
    code: 'j_tech_media',
    isic: 'J',
    fr: 'Information, télécoms, numérique, médias',
    en: 'Information, communication and media',
  },
  {
    code: 'k_finance',
    isic: 'K',
    fr: 'Finance et assurance',
    en: 'Financial and insurance activities',
  },
  { code: 'l_real_estate', isic: 'L', fr: 'Immobilier', en: 'Real estate' },
  {
    code: 'm_professional',
    isic: 'M',
    fr: 'Services professionnels, scientifiques et techniques',
    en: 'Professional, scientific and technical services',
  },
  {
    code: 'n_admin_support',
    isic: 'N',
    fr: 'Services administratifs et de soutien',
    en: 'Administrative and support services',
  },
  { code: 'o_public_admin', isic: 'O', fr: 'Administration publique', en: 'Public administration' },
  { code: 'p_education', isic: 'P', fr: 'Enseignement et formation', en: 'Education' },
  {
    code: 'q_health',
    isic: 'Q',
    fr: 'Santé et action sociale',
    en: 'Human health and social work',
  },
  {
    code: 'r_arts_leisure',
    isic: 'R',
    fr: 'Arts, spectacles, loisirs, sport',
    en: 'Arts, entertainment and recreation',
  },
  {
    code: 's_other_services',
    isic: 'S',
    fr: 'Autres services (associations, réparation, services à la personne)',
    en: 'Other service activities',
  },
  { code: 't_households', isic: 'T', fr: 'Activités des ménages', en: 'Activities of households' },
  {
    code: 'u_extraterritorial',
    isic: 'U',
    fr: 'Organisations internationales',
    en: 'Extraterritorial organizations',
  },
] as const;
export type Sector = (typeof SECTORS)[number]['code'];
export const SECTOR_CODES = SECTORS.map((s) => s.code) as [Sector, ...Sector[]];
export const sectorSchema = z.enum(SECTOR_CODES);
export const MAX_ORG_SECTORS = 10;

/** Domaine d'un site (https://www.exemple.sn/x → exemple.sn), sinon null. */
export function normalizeWebsiteDomain(input: string): string | null {
  let v = input.trim().toLowerCase();
  if (!v) return null;
  if (!/^https?:\/\//.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (u.username || u.password) return null;
    const host = u.hostname.replace(/^www\./, '').replace(/\.$/, '');
    return /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(host)
      ? host
      : null;
  } catch {
    return null;
  }
}

export const orgProfileSchema = z
  .object({
    accountType: accountTypeSchema,
    sectors: z
      .array(sectorSchema)
      .min(1)
      .max(MAX_ORG_SECTORS)
      .transform((a) => [...new Set(a)]),
    /**
     * Site web de l'expéditeur : seul domaine dont les liens sont conservés dans les brouillons
     * (liste blanche, revue étape 2 constat 7). `null` pour l'effacer.
     */
    website: z
      .string()
      .max(300)
      .nullable()
      .optional()
      .transform((v, ctx) => {
        if (v === undefined || v === null || v.trim() === '')
          return v === undefined ? undefined : null;
        const d = normalizeWebsiteDomain(v);
        if (!d) ctx.addIssue({ code: 'custom', message: 'site invalide' });
        return d;
      }),
  })
  .strict();
export type OrgProfile = z.infer<typeof orgProfileSchema>;
