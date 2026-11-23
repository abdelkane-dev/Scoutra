/** Envoi d'emails transactionnels (vérification, invitation, réinitialisation). */
import { safeFetch, type SafeFetchOptions } from '@scoutra/core';

export interface EmailMessage {
  to: string;
  kind: 'verify_email' | 'invitation' | 'reset_password';
  url: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Transport de développement : affiche le lien dans la console HORS production uniquement.
 * En production, refuse (aucun lien secret dans les journaux).
 */
export function createDevEmailSender(nodeEnv: string | undefined): EmailSender {
  return {
    async send(message) {
      if (nodeEnv === 'production') {
        throw new Error('Aucun transport email configuré en production');
      }
      console.info(`[email:${message.kind}] → ${message.to} : ${message.url}`);
    },
  };
}

const SUBJECTS: Record<EmailMessage['kind'], string> = {
  verify_email: 'Scoutra : confirmez votre adresse email / Confirm your email',
  invitation: 'Scoutra : vous êtes invité(e) / You have been invited',
  reset_password: 'Scoutra : réinitialisation du mot de passe / Reset your password',
};

const INTROS: Record<EmailMessage['kind'], string> = {
  verify_email:
    'Confirmez votre adresse email en ouvrant ce lien.\nConfirm your email address by opening this link.',
  invitation:
    'Vous avez été invité(e) à rejoindre une organisation sur Scoutra.\nYou have been invited to join an organization on Scoutra.',
  reset_password:
    'Pour choisir un nouveau mot de passe, ouvrez ce lien.\nTo choose a new password, open this link.',
};

/** Construit le message (texte brut uniquement : aucun HTML, aucune donnée externe). */
export function buildEmail(message: EmailMessage): { subject: string; text: string } {
  return {
    subject: SUBJECTS[message.kind],
    text: `${INTROS[message.kind]}\n\n${message.url}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.\nIf you did not request this, ignore this email.`,
  };
}

export interface ResendSenderConfig {
  apiKey: string;
  from: string;
  /** Injectable pour les tests. */
  fetcher?: (url: string, options: SafeFetchOptions) => Promise<{ status: number }>;
}

/**
 * Transport de production via l'API HTTP de Resend (https://resend.com), sans dépendance.
 * L'URL est fixe ; la clé n'est jamais journalisée.
 */
export function createResendEmailSender(config: ResendSenderConfig): EmailSender {
  const fetcher = config.fetcher ?? safeFetch;
  return {
    async send(message) {
      const { subject, text } = buildEmail(message);
      const res = await fetcher('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ from: config.from, to: [message.to], subject, text }),
        totalTimeoutMs: 15_000,
        maxBytes: 64 * 1024,
      });
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`Envoi d'email refusé par le prestataire (HTTP ${res.status})`);
      }
    },
  };
}

/** Choisit le transport : Resend si configuré, sinon console (hors production). */
export function createEmailSender(env: {
  NODE_ENV?: string;
  RESEND_API_KEY?: string;
  SCOUTRA_EMAIL_FROM?: string;
}): EmailSender {
  if (env.RESEND_API_KEY && env.SCOUTRA_EMAIL_FROM) {
    return createResendEmailSender({ apiKey: env.RESEND_API_KEY, from: env.SCOUTRA_EMAIL_FROM });
  }
  return createDevEmailSender(env.NODE_ENV);
}
