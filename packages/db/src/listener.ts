import pg from 'pg';

export const CAMPAIGN_EVENTS_CHANNEL = 'scoutra_campaign_events';

export interface CampaignEventListener {
  /** Réveil quand un événement de cette campagne est inséré ; renvoie la désinscription. */
  subscribe(campaignId: string, wake: () => void): () => void;
  close(): Promise<void>;
}

/**
 * UNE connexion dédiée par processus web, en LISTEN sur le canal des événements de campagne
 * (revue étape 2, constat 3) : les flux SSE attendent une notification au lieu d'interroger la
 * base en boucle. La notification ne porte que des identifiants ; les lignes sont relues sous RLS.
 * Reconnexion automatique ; en cas de coupure, les flux retombent sur une attente bornée.
 */
export function createCampaignEventListener(connectionString: string): CampaignEventListener {
  const subs = new Map<string, Set<() => void>>();
  let client: pg.Client | null = null;
  let closed = false;
  const connect = async () => {
    if (closed) return;
    const c = new pg.Client({ connectionString, application_name: 'scoutra-listen' });
    c.on('notification', (n) => {
      const id = n.payload?.split(':')[0];
      if (id) for (const wake of subs.get(id) ?? []) wake();
    });
    c.on('error', () => {
      client = null;
      void c.end().catch(() => undefined);
      setTimeout(() => void connect(), 2000);
    });
    try {
      await c.connect();
      await c.query(`LISTEN ${CAMPAIGN_EVENTS_CHANNEL}`);
      client = c;
    } catch {
      setTimeout(() => void connect(), 5000);
    }
  };
  void connect();
  return {
    subscribe(campaignId, wake) {
      let set = subs.get(campaignId);
      if (!set) subs.set(campaignId, (set = new Set()));
      set.add(wake);
      return () => {
        set.delete(wake);
        if (set.size === 0) subs.delete(campaignId);
      };
    },
    async close() {
      closed = true;
      await client?.end().catch(() => undefined);
    },
  };
}
