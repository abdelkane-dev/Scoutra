-- Relu à la main (revue étape 2, constat 16) : balayage des campagnes actives sans activité,
-- appelé par le worker pour relancer la vérification de clôture (au lieu d'un GET à effet de
-- bord). Fonction SECURITY DEFINER minimale : elle ne renvoie QUE des identifiants.
CREATE POLICY sweeper_read ON campaigns FOR SELECT TO scoutra_migrator USING (true);
--> statement-breakpoint
CREATE FUNCTION app_stale_campaigns() RETURNS TABLE (organization_id uuid, campaign_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT c.organization_id, c.id FROM campaigns c
     WHERE c.status IN ('running', 'cancelling')
       AND c.updated_at < now() - interval '5 minutes'
     ORDER BY c.updated_at
     LIMIT 500
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_stale_campaigns() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_stale_campaigns() TO scoutra_app;
