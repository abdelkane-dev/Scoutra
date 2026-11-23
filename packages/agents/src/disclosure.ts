import type { ContactChannel } from '@scoutra/core';

/**
 * Divulgation d'une coordonnée dans la fiche prospect (revue étape 2, constats 6 et 17) :
 * en clair UNIQUEMENT si le prospect est livré ET si le garde-fou juridique autorise ce canal ;
 * sinon rien (pas même un masque partiel), seulement le fait qu'elle existe.
 */
export function canDisclose(i: {
  channel: string;
  delivered: boolean;
  allowedChannels: readonly string[];
}): boolean {
  return i.delivered && i.allowedChannels.includes(i.channel);
}

export function discloseContact(i: {
  channel: ContactChannel;
  value: string | null;
  delivered: boolean;
  allowedChannels: readonly string[];
}): { value: string | null; revealed: boolean; found: boolean } {
  const reveal = i.delivered && i.value !== null && i.allowedChannels.includes(i.channel);
  // `found` : la coordonnée existe (ligne présente), même si elle n'est pas divulguée.
  return { value: reveal ? i.value : null, revealed: reveal, found: true };
}

/** Canaux autorisés d'après les décisions stockées (tout sauf `deny`). */
export function allowedChannelsOf(decisions: unknown): string[] {
  if (!Array.isArray(decisions)) return [];
  return decisions
    .filter((d): d is { channel: string; outcome: string } => typeof d?.channel === 'string')
    .filter((d) => d.outcome !== 'deny')
    .map((d) => d.channel);
}
