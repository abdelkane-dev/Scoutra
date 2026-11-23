import { z } from 'zod';
import type { LlmClient, ModelTier, Usage } from '@scoutra/ai';
import type { ContactChannel } from '@scoutra/core';
import { legalFooter, type ComplianceDecision } from '@scoutra/compliance';
import { DATA_POLICY_FR, externalData, userRequest } from './policy';

/** Qualité de rédaction (barème : standard inclus, soignée +1 crédit, premium +3). */
export const DRAFT_QUALITIES = ['standard', 'careful', 'premium'] as const;
export type DraftQuality = (typeof DRAFT_QUALITIES)[number];

export const QUALITY_MODEL: Record<DraftQuality, { tier: ModelTier; effort: 'low' | 'medium' }> = {
  standard: { tier: 'fast', effort: 'low' },
  careful: { tier: 'balanced', effort: 'low' },
  premium: { tier: 'strong', effort: 'medium' },
};

/** Bornes par canal (ARCHITECTURE §3.2). */
export const CHANNEL_LIMITS: Partial<Record<ContactChannel, number>> = {
  email: 1200,
  whatsapp: 700,
  website_form: 1000,
  social_page: 600,
  phone: 600,
};

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'()\]]{1,300}/gi;

/**
 * Liens du brouillon (revue étape 2, constat 7) : seuls les domaines autorisés (ceux de
 * l'expéditeur) sont conservés ; tout autre lien, même produit par une injection dans une page
 * lue, est retiré. L'utilisateur relit toujours avant d'envoyer.
 */
export function sanitizeLinks(
  text: string,
  allowedDomains: readonly string[],
): { text: string; removed: number } {
  let removed = 0;
  const out = text.replace(URL_RE, (raw) => {
    let host = '';
    try {
      host = new URL(raw.startsWith('www.') ? `https://${raw}` : raw).hostname
        .toLowerCase()
        .replace(/^www\./, '');
    } catch {
      host = '';
    }
    const ok = host && allowedDomains.some((d) => host === d || host.endsWith(`.${d}`));
    if (ok) return raw;
    removed++;
    return '[lien retiré]';
  });
  return { text: out, removed };
}

export interface DraftInput {
  channel: ContactChannel;
  language: 'fr' | 'en';
  quality: DraftQuality;
  decision: ComplianceDecision;
  sender: {
    name: string;
    offer: string;
    tone?: string;
    address?: string;
    /** Domaines dont les liens sont autorisés dans le message (site de l'expéditeur). */
    linkDomains?: readonly string[];
  };
  prospect: {
    displayName: string;
    category?: string | null;
    city?: string | null;
    description?: string | null;
    signals: string[];
  };
  reasons: string[];
}

export interface Draft {
  subject?: string;
  body: string;
  footer: string;
  hooks: string[];
  generatedBy: 'ai' | 'template';
  usage?: Usage;
}

const SYSTEM = `Tu es l'agent Rédaction de Scoutra. Tu écris un PREMIER message de prospection, court, personnalisé, honnête et respectueux, que l'utilisateur relira et enverra LUI-MÊME.
- N'utilise que les faits fournis ; pas de flatterie excessive, pas de fausse urgence, pas de lien inventé.
- Pas de formule d'opposition ni de mention légale : elles sont ajoutées automatiquement.
- Téléphone : script d'appel en 3 à 5 phrases. Page publique (réseau social) : réponse publique utile et non intrusive.
- Pas d'objet (subject) sauf pour l'email.

${DATA_POLICY_FR}`;

function draftSchema(channel: ContactChannel) {
  const max = CHANNEL_LIMITS[channel] ?? 800;
  return z
    .object({
      subject: channel === 'email' ? z.string().min(3).max(90) : z.string().max(0).optional(),
      body: z.string().min(20).max(max),
      hooks: z.array(z.string().max(120)).max(3),
    })
    .strict();
}

function templateDraft(i: DraftInput): Omit<Draft, 'footer'> {
  const fr = i.language === 'fr';
  const where = i.prospect.city ? (fr ? ` à ${i.prospect.city}` : ` in ${i.prospect.city}`) : '';
  const body = fr
    ? `Bonjour,\n\nJe me permets de vous contacter au sujet de ${i.prospect.displayName}${where}. ${i.sender.offer}\n\nSeriez-vous disponible pour un court échange ?\n\nCordialement,\n${i.sender.name}`
    : `Hello,\n\nI am reaching out about ${i.prospect.displayName}${where}. ${i.sender.offer}\n\nWould you be open to a short call?\n\nBest regards,\n${i.sender.name}`;
  return {
    subject:
      i.channel === 'email'
        ? fr
          ? `${i.sender.name} — proposition`
          : `${i.sender.name} — proposal`
        : undefined,
    body: body.slice(0, CHANNEL_LIMITS[i.channel] ?? 800),
    hooks: [],
    generatedBy: 'template',
  };
}

/**
 * Agent Rédaction : REFUSE si le garde-fou a refusé le canal. Le pied de page légal est injecté
 * par le code (gabarit pays). Sans IA : modèle de message simple, signalé comme tel.
 */
export async function draftMessage(
  i: DraftInput,
  llm: LlmClient,
  signal?: AbortSignal,
): Promise<Draft> {
  if (i.decision.outcome === 'deny' || i.decision.channel !== i.channel)
    throw new Error('Canal refusé par le garde-fou juridique : aucune rédaction');
  const footer =
    i.decision.outcome === 'manual_only'
      ? ''
      : legalFooter(i.decision.conditions.footer, i.language, i.sender);
  if (!llm.available) return { ...templateDraft(i), footer };
  const q = QUALITY_MODEL[i.quality];
  const r = await llm.generate({
    agent: 'drafting',
    tier: q.tier,
    effort: q.effort,
    system: SYSTEM,
    input: [
      `Canal : ${i.channel} ; langue : ${i.language} ; ton : ${i.sender.tone ?? 'professionnel et chaleureux'}`,
      `Expéditeur : ${i.sender.name}`,
      // L'offre est saisie par l'utilisateur : encapsulée comme donnée (constat 7).
      `Offre de l'expéditeur (donnée) :\n${userRequest(i.sender.offer, 600)}`,
      `Raisons du ciblage : ${i.reasons.slice(0, 5).join(' ; ')}`,
      externalData(
        'prospect',
        [
          i.prospect.displayName,
          i.prospect.category,
          i.prospect.city,
          i.prospect.description,
          ...i.prospect.signals,
        ]
          .filter(Boolean)
          .join('\n'),
        2500,
      ),
    ].join('\n'),
    schema: draftSchema(i.channel),
    maxOutputTokens: 1500,
    signal,
  });
  const allowed = i.sender.linkDomains ?? [];
  const body = sanitizeLinks(r.output.body, allowed).text;
  const subject = r.output.subject ? sanitizeLinks(r.output.subject, allowed).text : undefined;
  return {
    subject: subject || undefined,
    body,
    hooks: r.output.hooks,
    footer,
    generatedBy: 'ai',
    usage: r.usage,
  };
}
