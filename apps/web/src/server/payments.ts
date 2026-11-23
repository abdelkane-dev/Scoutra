import 'server-only';
import type { PaymentProvider } from '@scoutra/billing';

/**
 * Prestataire de paiement (carte bancaire, international) : AUCUN n'est encore choisi.
 * Brancher ici un adaptateur implémentant `PaymentProvider` (signature du webhook vérifiée par
 * l'adaptateur, ex. `verifySignedPayload`). Tant qu'il n'y en a pas, le webhook répond 404.
 */
export function getPaymentProvider(): PaymentProvider | null {
  return null;
}
