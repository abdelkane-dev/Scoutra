import { z } from 'zod';

/**
 * Référentiels métier partagés (TypeScript = source de vérité).
 *
 * Les modèles de prospection et les types de prospect sont stockés en base dans des
 * TABLES DE RÉFÉRENCE (pas des enums Postgres) : pour en ajouter un, on l'ajoute ici
 * puis dans une migration qui insère la ligne. Un test vérifie que la base et ce
 * fichier restent synchronisés.
 */

/** Types d'entité prospectée (entité typée de premier niveau, pas « entreprise + contact »). */
export const PROSPECT_KINDS = [
  'company',
  'person',
  'creator',
  'public_buyer',
  'nonprofit',
  'property',
  'listing',
] as const;
export type ProspectKind = (typeof PROSPECT_KINDS)[number];
export const prospectKindSchema = z.enum(PROSPECT_KINDS);

export interface ProspectingModelDef {
  code: string;
  /** Types d'entité habituellement visés par ce modèle. */
  defaultKinds: readonly ProspectKind[];
  /** Vrai si la cible inclut des particuliers : règles de consentement plus strictes. */
  involvesIndividuals: boolean;
}

/** Modèles de prospection (cf. docs/recherche/concurrents.md §2). */
export const PROSPECTING_MODELS = [
  { code: 'b2b', defaultKinds: ['company'], involvesIndividuals: false },
  { code: 'b2c', defaultKinds: ['person'], involvesIndividuals: true },
  { code: 'b2b2c', defaultKinds: ['company'], involvesIndividuals: false },
  { code: 'd2c', defaultKinds: ['person', 'company'], involvesIndividuals: true },
  { code: 'c2c', defaultKinds: ['person', 'listing'], involvesIndividuals: true },
  { code: 'c2b', defaultKinds: ['company'], involvesIndividuals: false },
  { code: 'b2g', defaultKinds: ['public_buyer'], involvesIndividuals: false },
  { code: 'g2b', defaultKinds: ['company'], involvesIndividuals: false },
  { code: 'b2n', defaultKinds: ['nonprofit'], involvesIndividuals: false },
  { code: 'b2e', defaultKinds: ['company'], involvesIndividuals: false },
  { code: 'partners_distributors', defaultKinds: ['company'], involvesIndividuals: false },
  { code: 'talent_recruiting', defaultKinds: ['person', 'company'], involvesIndividuals: true },
  { code: 'investors_fundraising', defaultKinds: ['company', 'person'], involvesIndividuals: true },
  {
    code: 'real_estate',
    defaultKinds: ['property', 'listing', 'person', 'company'],
    involvesIndividuals: true,
  },
  { code: 'local_business', defaultKinds: ['company'], involvesIndividuals: false },
  { code: 'marketplace_sellers', defaultKinds: ['company', 'creator'], involvesIndividuals: true },
  { code: 'distressed_insolvency', defaultKinds: ['company'], involvesIndividuals: false },
  { code: 'business_succession', defaultKinds: ['company'], involvesIndividuals: false },
  { code: 'events_exhibitors', defaultKinds: ['company', 'person'], involvesIndividuals: true },
  { code: 'press_pr', defaultKinds: ['person', 'creator'], involvesIndividuals: true },
  { code: 'procurement_sourcing', defaultKinds: ['company'], involvesIndividuals: false },
  { code: 'regulated_professions', defaultKinds: ['person', 'company'], involvesIndividuals: true },
  {
    code: 'education_institutions',
    defaultKinds: ['public_buyer', 'nonprofit', 'company'],
    involvesIndividuals: false,
  },
] as const satisfies readonly ProspectingModelDef[];

export type ProspectingModel = (typeof PROSPECTING_MODELS)[number]['code'];
export const PROSPECTING_MODEL_CODES = PROSPECTING_MODELS.map((m) => m.code) as [
  ProspectingModel,
  ...ProspectingModel[],
];
export const prospectingModelSchema = z.enum(PROSPECTING_MODEL_CODES);

/** Bases légales enregistrées pour chaque preuve (RGPD art. 6, loi malienne 2013-015). */
export const LEGAL_BASES = [
  'consent',
  'legitimate_interest',
  'public_professional',
  'contract',
] as const;
export type LegalBasis = (typeof LEGAL_BASES)[number];
export const legalBasisSchema = z.enum(LEGAL_BASES);

export const CONTACT_CHANNELS = [
  'email',
  'phone',
  'whatsapp',
  'website_form',
  'social_page',
  'postal',
] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];
export const contactChannelSchema = z.enum(CONTACT_CHANNELS);

/** Statuts de vérification normalisés (cf. étude concurrents §6.7). */
export const VERIFICATION_STATUSES = [
  'unknown',
  'valid',
  'invalid',
  'risky',
  'accept_all',
  'webmail',
  'disposable',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Rôles d'une organisation, du plus élevé au plus bas. */
export const ORG_ROLES = ['owner', 'admin', 'member'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];
export const orgRoleSchema = z.enum(ORG_ROLES);

export const SCOUTRA_MODES = ['saas', 'license'] as const;
export type ScoutraMode = (typeof SCOUTRA_MODES)[number];
