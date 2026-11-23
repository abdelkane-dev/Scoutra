import { z } from 'zod';
import {
  ACCOUNT_TYPE_CODES,
  CONTACT_CHANNELS,
  PROSPECTING_MODELS,
  PROSPECTING_MODEL_CODES,
  PROSPECT_KINDS,
  SECTOR_CODES,
  SIGNAL_KEYS,
  type AccountType,
  type ContactChannel,
  type ProspectingModel,
  type Sector,
  type SignalKey,
  isIndividualKind,
} from '@scoutra/core';

/**
 * Playbooks : un par modèle de prospection (règle d'architecture, étude concurrents §2).
 * Configuration DÉCLARATIVE (sources, signaux, canaux, règles, suggestions), pas de code par cas.
 * Source de vérité ici ; copiés en base (table `playbooks`, versionnée) par la migration du worker.
 */
export const playbookSchema = z
  .object({
    model: z.enum(PROSPECTING_MODEL_CODES),
    version: z.int().min(1),
    kinds: z.array(z.enum(PROSPECT_KINDS)).min(1),
    /** Sources par ordre de priorité ; `web_search` = le moteur configuré. */
    connectors: z.array(z.string().regex(/^[a-z_]{3,40}$/)).min(1),
    signals: z.array(z.enum(SIGNAL_KEYS)),
    /** Canaux envisagés (le garde-fou juridique décide ensuite, pays par pays). */
    channels: z.array(z.enum(CONTACT_CHANNELS)).min(1),
    /** Public visé pour le garde-fou : personnes morales, particuliers, ou selon le prospect. */
    audience: z.enum(['business', 'individual', 'per_prospect']),
    rules: z
      .object({
        /** Particuliers : uniquement des signaux publics (jamais de liste de personnes). */
        publicSignalsOnly: z.boolean(),
        minScore: z.int().min(0).max(100),
        defaultMaxProspects: z.int().min(10).max(1500),
      })
      .strict(),
    suggestedFor: z
      .object({
        accountTypes: z.array(z.enum(ACCOUNT_TYPE_CODES)),
        sectors: z.union([z.literal('all'), z.array(z.enum(SECTOR_CODES))]),
      })
      .strict(),
    messageAngle: z.object({ fr: z.string().max(200), en: z.string().max(200) }).strict(),
  })
  .strict();
export type Playbook = z.infer<typeof playbookSchema>;

const B2B_SOURCES = [
  'fr_recherche_entreprises',
  'uk_companies_house',
  'osm_overpass',
  'web_search',
  'google_places',
  'crtsh',
];
const LOCAL_SOURCES = [
  'osm_overpass',
  'google_places',
  'web_search',
  'fr_recherche_entreprises',
  'uk_companies_house',
];
const PUBLIC_SIGNALS = ['web_search'];
const ALL_TYPES: AccountType[] = [
  'individual',
  'freelancer',
  'sme',
  'startup',
  'enterprise',
  'nonprofit',
  'public_sector',
  'agency',
];
const PRO_TYPES: AccountType[] = ['freelancer', 'sme', 'startup', 'enterprise', 'agency'];

function pb(
  model: ProspectingModel,
  o: {
    connectors: string[];
    signals: SignalKey[];
    channels: ContactChannel[];
    audience: Playbook['audience'];
    types: AccountType[];
    sectors: Sector[] | 'all';
    angle: [string, string];
    minScore?: number;
    max?: number;
  },
): Playbook {
  const def = PROSPECTING_MODELS.find((m) => m.code === model)!;
  return playbookSchema.parse({
    model,
    version: 1,
    kinds: [...def.defaultKinds],
    connectors: o.connectors,
    signals: o.signals,
    channels: o.channels,
    audience: o.audience,
    rules: {
      publicSignalsOnly: def.involvesIndividuals && o.audience !== 'business',
      minScore: o.minScore ?? 45,
      defaultMaxProspects: o.max ?? 100,
    },
    suggestedFor: { accountTypes: o.types, sectors: o.sectors },
    messageAngle: { fr: o.angle[0], en: o.angle[1] },
  });
}

const BIZ: ContactChannel[] = ['email', 'phone', 'website_form'];

export const PLAYBOOKS: readonly Playbook[] = [
  pb('b2b', {
    connectors: B2B_SOURCES,
    signals: ['new_company', 'hiring', 'funding', 'new_domain', 'outdated_website'],
    channels: BIZ,
    audience: 'business',
    types: PRO_TYPES,
    sectors: 'all',
    angle: [
      'Problème métier précis de l’entreprise et bénéfice mesurable',
      'A specific business problem and a measurable benefit',
    ],
  }),
  pb('b2c', {
    connectors: PUBLIC_SIGNALS,
    signals: ['public_request'],
    channels: ['social_page'],
    audience: 'individual',
    types: ['individual', 'freelancer', 'sme', 'agency'],
    sectors: [
      'f_construction',
      'g_trade',
      'l_real_estate',
      'p_education',
      'q_health',
      's_other_services',
      'r_arts_leisure',
      'i_hospitality',
    ],
    angle: [
      'Réponse publique utile à une demande exprimée',
      'A helpful public reply to an expressed need',
    ],
    minScore: 35,
  }),
  pb('b2b2c', {
    connectors: B2B_SOURCES,
    signals: ['new_location', 'product_launch', 'hiring'],
    channels: BIZ,
    audience: 'business',
    types: ['startup', 'sme', 'enterprise', 'agency'],
    sectors: ['j_tech_media', 'k_finance', 'g_trade', 'q_health'],
    angle: [
      'Valeur pour les clients finaux de l’entreprise',
      'Value for the company’s end customers',
    ],
  }),
  pb('d2c', {
    connectors: ['web_search', 'osm_overpass', 'google_places'],
    signals: ['public_request', 'recent_reviews'],
    channels: ['email', 'website_form', 'social_page'],
    audience: 'per_prospect',
    types: ['startup', 'sme', 'freelancer'],
    sectors: ['g_trade', 'c_manufacturing'],
    angle: [
      'Partenariat revendeur ou réponse à une demande publique',
      'Reseller partnership or reply to a public request',
    ],
  }),
  pb('c2c', {
    connectors: PUBLIC_SIGNALS,
    signals: ['active_listing', 'public_request'],
    channels: ['social_page'],
    audience: 'individual',
    types: ['individual', 'freelancer'],
    sectors: 'all',
    angle: [
      'Réponse à une annonce publique, via la plateforme',
      'Reply to a public listing, through the platform',
    ],
    minScore: 30,
  }),
  pb('c2b', {
    connectors: ['web_search', 'fr_recherche_entreprises', 'uk_companies_house', 'crtsh'],
    signals: ['product_launch', 'hiring', 'funding', 'new_company'],
    channels: BIZ,
    audience: 'business',
    types: ['freelancer', 'individual', 'agency'],
    sectors: ['j_tech_media', 'm_professional', 'r_arts_leisure'],
    angle: [
      'Prestation ciblée au moment d’un lancement ou recrutement',
      'A targeted service at a launch or hiring moment',
    ],
  }),
  pb('b2g', {
    connectors: ['web_search', 'osm_overpass'],
    signals: ['public_tender'],
    channels: ['email', 'website_form'],
    audience: 'business',
    types: ['sme', 'enterprise', 'agency', 'startup'],
    sectors: [
      'f_construction',
      'j_tech_media',
      'm_professional',
      'n_admin_support',
      'e_water_waste',
    ],
    angle: [
      'Référence aux besoins publics et aux procédures de marché',
      'Reference to public needs and procurement rules',
    ],
  }),
  pb('g2b', {
    connectors: ['fr_recherche_entreprises', 'uk_companies_house', 'web_search', 'osm_overpass'],
    signals: ['new_company', 'hiring'],
    channels: ['email', 'website_form'],
    audience: 'business',
    types: ['public_sector', 'nonprofit'],
    sectors: 'all',
    angle: [
      'Information sur un dispositif d’aide ou un appel à candidatures',
      'Information about a support scheme or call for applications',
    ],
  }),
  pb('b2n', {
    connectors: ['fr_recherche_entreprises', 'uk_companies_house', 'osm_overpass', 'web_search'],
    signals: ['funding', 'event_participation'],
    channels: BIZ,
    audience: 'business',
    types: PRO_TYPES,
    sectors: 'all',
    angle: ['Mission de l’organisation et impact', 'The organisation’s mission and impact'],
  }),
  pb('b2e', {
    connectors: B2B_SOURCES,
    signals: ['hiring', 'new_location'],
    channels: BIZ,
    audience: 'business',
    types: ['sme', 'startup', 'agency'],
    sectors: ['k_finance', 'q_health', 'r_arts_leisure', 'i_hospitality', 'p_education'],
    angle: ['Avantages salariés et fidélisation des équipes', 'Employee benefits and retention'],
  }),
  pb('partners_distributors', {
    connectors: [
      'web_search',
      'osm_overpass',
      'google_places',
      'fr_recherche_entreprises',
      'uk_companies_house',
    ],
    signals: ['new_location', 'product_launch'],
    channels: BIZ,
    audience: 'business',
    types: ['sme', 'startup', 'enterprise'],
    sectors: ['c_manufacturing', 'g_trade', 'j_tech_media'],
    angle: ['Partenariat de distribution gagnant-gagnant', 'A win-win distribution partnership'],
  }),
  pb('talent_recruiting', {
    connectors: ['web_search', 'fr_recherche_entreprises', 'uk_companies_house'],
    signals: ['hiring', 'new_company', 'funding'],
    channels: BIZ,
    audience: 'business',
    types: ['agency', 'freelancer', 'sme'],
    sectors: ['n_admin_support', 'm_professional'],
    angle: [
      'Aide au recrutement en cours (offres publiées)',
      'Help with current hiring (published openings)',
    ],
  }),
  pb('investors_fundraising', {
    connectors: ['web_search', 'fr_recherche_entreprises', 'uk_companies_house', 'crtsh'],
    signals: ['funding', 'new_company', 'product_launch'],
    channels: ['email', 'website_form'],
    audience: 'business',
    types: ['startup', 'enterprise', 'agency'],
    sectors: ['k_finance', 'j_tech_media'],
    angle: ['Thèse d’investissement et adéquation précise', 'Investment thesis and precise fit'],
  }),
  pb('real_estate', {
    connectors: ['web_search', 'osm_overpass', 'google_places'],
    signals: ['active_listing', 'public_request', 'new_location'],
    channels: ['social_page', 'email', 'phone'],
    audience: 'per_prospect',
    types: ['agency', 'freelancer', 'sme', 'individual'],
    sectors: ['l_real_estate', 'f_construction'],
    angle: [
      'Réponse à un projet immobilier exprimé publiquement',
      'Reply to a publicly expressed property project',
    ],
    minScore: 35,
  }),
  pb('local_business', {
    connectors: LOCAL_SOURCES,
    signals: ['no_website', 'outdated_website', 'recent_reviews', 'new_location'],
    channels: ['phone', 'email', 'website_form'],
    audience: 'business',
    types: ALL_TYPES,
    sectors: 'all',
    angle: [
      'Amélioration concrète et locale (site, visibilité, service)',
      'A concrete local improvement (website, visibility, service)',
    ],
  }),
  pb('marketplace_sellers', {
    connectors: ['web_search', 'crtsh'],
    signals: ['product_launch', 'new_domain'],
    channels: ['email', 'website_form', 'social_page'],
    audience: 'per_prospect',
    types: ['agency', 'freelancer', 'startup'],
    sectors: ['g_trade', 'j_tech_media'],
    angle: ['Croissance des ventes en ligne du vendeur', 'Growing the seller’s online sales'],
  }),
  pb('distressed_insolvency', {
    connectors: ['uk_companies_house', 'fr_recherche_entreprises', 'web_search'],
    signals: ['insolvency'],
    channels: ['email', 'website_form'],
    audience: 'business',
    types: ['agency', 'sme', 'enterprise'],
    sectors: ['k_finance', 'm_professional'],
    angle: [
      'Accompagnement respectueux en période difficile',
      'Respectful support in a difficult period',
    ],
    minScore: 50,
  }),
  pb('business_succession', {
    connectors: ['fr_recherche_entreprises', 'uk_companies_house', 'web_search'],
    signals: ['leadership_change'],
    channels: ['email', 'website_form'],
    audience: 'business',
    types: ['agency', 'enterprise', 'sme'],
    sectors: ['k_finance', 'm_professional'],
    angle: [
      'Transmission ou reprise, en toute discrétion',
      'Succession or acquisition, discreetly',
    ],
    minScore: 50,
  }),
  pb('events_exhibitors', {
    connectors: ['web_search', 'fr_recherche_entreprises', 'uk_companies_house'],
    signals: ['event_participation', 'product_launch'],
    channels: BIZ,
    audience: 'business',
    types: ['agency', 'sme', 'startup', 'nonprofit'],
    sectors: ['r_arts_leisure', 'n_admin_support', 'j_tech_media'],
    angle: ['Participation à un événement à venir', 'Participation in an upcoming event'],
  }),
  pb('press_pr', {
    connectors: ['web_search'],
    signals: ['product_launch', 'funding'],
    channels: ['email', 'website_form'],
    audience: 'business',
    types: ['agency', 'startup', 'sme', 'nonprofit', 'freelancer'],
    sectors: ['j_tech_media'],
    angle: [
      'Sujet d’actualité pertinent pour le média (contact de rédaction publié)',
      'A newsworthy angle for the outlet (published newsroom contact)',
    ],
  }),
  pb('procurement_sourcing', {
    connectors: [
      'web_search',
      'fr_recherche_entreprises',
      'uk_companies_house',
      'osm_overpass',
      'google_places',
    ],
    signals: ['new_company', 'product_launch'],
    channels: BIZ,
    audience: 'business',
    types: ['sme', 'enterprise', 'public_sector', 'startup'],
    sectors: 'all',
    angle: [
      'Demande de devis ou de catalogue fournisseur',
      'Request for a supplier quote or catalogue',
    ],
  }),
  pb('regulated_professions', {
    connectors: ['osm_overpass', 'google_places', 'web_search', 'fr_recherche_entreprises'],
    signals: ['new_location', 'outdated_website'],
    channels: ['email', 'website_form', 'phone'],
    audience: 'business',
    types: ['sme', 'startup', 'agency', 'freelancer'],
    sectors: ['q_health', 'm_professional', 'k_finance'],
    angle: [
      'Offre conforme aux règles de la profession (démarchage encadré)',
      'An offer compliant with professional rules',
    ],
    minScore: 55,
  }),
  pb('education_institutions', {
    connectors: [
      'osm_overpass',
      'fr_recherche_entreprises',
      'uk_companies_house',
      'web_search',
      'google_places',
    ],
    signals: ['public_tender', 'hiring'],
    channels: ['email', 'website_form', 'phone'],
    audience: 'business',
    types: ['sme', 'startup', 'nonprofit', 'agency', 'freelancer'],
    sectors: ['p_education', 'j_tech_media'],
    angle: [
      'Bénéfice pédagogique ou administratif concret',
      'A concrete educational or administrative benefit',
    ],
  }),
];

export function playbookFor(model: ProspectingModel): Playbook {
  return PLAYBOOKS.find((p) => p.model === model)!;
}

/** Playbooks priorisés selon le profil de l'organisation (type de compte + secteurs). */
export function suggestPlaybooks(
  accountType: AccountType | null | undefined,
  sectors: readonly Sector[],
): { model: ProspectingModel; score: number }[] {
  return PLAYBOOKS.map((p) => {
    let score = 0;
    if (accountType && p.suggestedFor.accountTypes.includes(accountType)) score += 2;
    if (p.suggestedFor.sectors === 'all') score += sectors.length ? 0.5 : 0;
    else {
      const list = p.suggestedFor.sectors as readonly Sector[];
      score += sectors.filter((s) => list.includes(s)).length * 1.5;
      if (sectors.includes(list[0]!)) score += 1; // secteur principal du playbook
    }
    return { model: p.model, score };
  }).sort(
    (a, b) =>
      b.score - a.score ||
      PLAYBOOKS.findIndex((p) => p.model === a.model) -
        PLAYBOOKS.findIndex((p) => p.model === b.model),
  );
}

/** Les types visés par une fiche doivent appartenir au playbook de son modèle (constat 1). */
export function kindsAllowed(spec: { model: ProspectingModel; kinds: readonly string[] }): boolean {
  const allowed = playbookFor(spec.model).kinds as readonly string[];
  return spec.kinds.every((k) => allowed.includes(k));
}

/**
 * Public juridique d'un prospect : PARTICULIER dès que l'entité est (ou peut être) une personne,
 * quel que soit le playbook ; sinon celui du playbook (un playbook « particuliers » le reste).
 */
export function legalAudience(playbook: Playbook, kind: string): 'individual' | 'business' {
  if (isIndividualKind(kind) || playbook.audience === 'individual') return 'individual';
  return 'business';
}
