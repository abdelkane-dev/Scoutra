import { z } from 'zod';
import { isoCountrySchema } from './countries';
import { contactChannelSchema, prospectKindSchema, prospectingModelSchema } from './domain';
import { sectorSchema } from './profile';

/** Signaux d'achat reconnus (docs/recherche/concurrents.md §3). Extensible. */
export const SIGNAL_KEYS = [
  'new_company',
  'new_domain',
  'hiring',
  'funding',
  'public_request',
  'new_location',
  'no_website',
  'outdated_website',
  'recent_reviews',
  'public_tender',
  'insolvency',
  'leadership_change',
  'product_launch',
  'event_participation',
  'active_listing',
] as const;
export type SignalKey = (typeof SIGNAL_KEYS)[number];
export const signalKeySchema = z.enum(SIGNAL_KEYS);

const shortText = (max: number) => z.string().trim().min(1).max(max);

/**
 * Profil de cible structuré (sortie de l'agent Interprète, éditable par l'utilisateur avant
 * lancement). Tous les modèles de prospection (B2B, B2C, B2G…) partagent ce schéma.
 */
export const targetSpecSchema = z
  .object({
    model: prospectingModelSchema,
    kinds: z.array(prospectKindSchema).min(1).max(4),
    summary: shortText(300),
    language: z.enum(['fr', 'en']),
    countries: z.array(isoCountrySchema).min(1).max(20),
    /** Villes ou régions (texte libre court). */
    regions: z.array(shortText(100)).max(20),
    /** Termes de recherche : activités, catégories, produits. */
    keywords: z.array(shortText(60)).min(1).max(15),
    sectors: z.array(sectorSchema).max(10),
    /** Décideurs ciblés (B2B) ou professions (B2C professionnel). */
    roles: z.array(shortText(80)).max(10),
    companySize: z
      .object({ min: z.int().min(0).optional(), max: z.int().min(1).optional() })
      .strict()
      .optional(),
    signals: z.array(z.object({ key: signalKeySchema, required: z.boolean() }).strict()).max(10),
    exclusions: z.array(shortText(100)).max(20),
    /** Canaux souhaités ; le garde-fou juridique décide ensuite des canaux autorisés. */
    channels: z.array(contactChannelSchema).max(6),
  })
  .strict();
export type TargetSpec = z.infer<typeof targetSpecSchema>;
