/**
 * Exécuté une fois au démarrage du serveur Next.js. La logique (validation de la
 * configuration, contrôle du rôle Postgres, refus de démarrer) est dans un module Node.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
