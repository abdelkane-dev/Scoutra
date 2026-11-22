/** Envoi d'emails transactionnels (vérification, invitation). Transport réel : étape ultérieure. */
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
