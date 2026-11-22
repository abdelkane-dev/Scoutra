-- Migration de sécurité (relue à la main). Voir docs/ARCHITECTURE.md §2.7 et threat-model E1/E9.
-- Rôles : scoutra_migrator (propriétaire, exécute ceci), scoutra_app (web + worker, SANS BYPASSRLS),
-- scoutra_auth (Better Auth, tables d'identité uniquement). Les rôles LOGIN avec mot de passe sont
-- créés par l'initialisation Postgres (docker/postgres/init) ; ici on les crée NOLOGIN s'ils manquent.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scoutra_app') THEN
    CREATE ROLE scoutra_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scoutra_auth') THEN
    CREATE ROLE scoutra_auth NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
REVOKE ALL ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO scoutra_app, scoutra_auth;
--> statement-breakpoint
-- Organisation courante de la transaction (fixée par withTenant via set_config(..., true)).
-- Absente => NULL => aucune ligne visible (refus par défaut).
CREATE FUNCTION app_current_org_id() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_current_org_id() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_current_org_id() TO scoutra_app;
--> statement-breakpoint
CREATE FUNCTION forbid_mutation() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  RAISE EXCEPTION 'La table % est en ajout seul', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END
$$;
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER credit_ledger_append_only BEFORE UPDATE OR DELETE ON credit_ledger FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER credit_ledger_no_truncate BEFORE TRUNCATE ON credit_ledger FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE campaigns FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE target_profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE target_profiles FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE prospects FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE evidence FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE api_credentials FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE suppression_list ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE suppression_list FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE credit_ledger FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE members FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON campaigns FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON target_profiles FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON prospects FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON contacts FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON evidence FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON api_credentials FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON suppression_list FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON audit_log FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON credit_ledger FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON organizations FOR SELECT TO scoutra_app USING (id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON members FOR SELECT TO scoutra_app USING (organization_id = app_current_org_id());
--> statement-breakpoint
-- Better Auth gère lui-même l'appartenance (plugin organisation) ; le rôle scoutra_auth n'a
-- aucun accès aux tables métier.
CREATE POLICY auth_service ON organizations FOR ALL TO scoutra_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
-- Better Auth gère lui-même l'appartenance (plugin organisation) ; le rôle scoutra_auth n'a
-- aucun accès aux tables métier.
CREATE POLICY auth_service ON members FOR ALL TO scoutra_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
-- Better Auth gère lui-même l'appartenance (plugin organisation) ; le rôle scoutra_auth n'a
-- aucun accès aux tables métier.
CREATE POLICY auth_service ON invitations FOR ALL TO scoutra_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON campaigns TO scoutra_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON target_profiles TO scoutra_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON prospects TO scoutra_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON contacts TO scoutra_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON evidence TO scoutra_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON api_credentials TO scoutra_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON suppression_list TO scoutra_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON audit_log TO scoutra_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE audit_log_id_seq TO scoutra_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON credit_ledger TO scoutra_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE credit_ledger_id_seq TO scoutra_app;
--> statement-breakpoint
GRANT SELECT ON organizations, members TO scoutra_app;
--> statement-breakpoint
GRANT SELECT ON prospect_kinds, prospecting_models, playbooks TO scoutra_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON users, sessions, accounts, verifications, organizations, members, invitations, two_factors, rate_limits TO scoutra_auth;
--> statement-breakpoint
INSERT INTO prospect_kinds (code) VALUES ('company'), ('person'), ('creator'), ('public_buyer'), ('nonprofit'), ('property'), ('listing');
--> statement-breakpoint
INSERT INTO prospecting_models (code, involves_individuals, default_kinds) VALUES
  ('b2b', false, ARRAY['company']::text[]),
  ('b2c', true, ARRAY['person']::text[]),
  ('b2b2c', false, ARRAY['company']::text[]),
  ('d2c', true, ARRAY['person', 'company']::text[]),
  ('c2c', true, ARRAY['person', 'listing']::text[]),
  ('c2b', false, ARRAY['company']::text[]),
  ('b2g', false, ARRAY['public_buyer']::text[]),
  ('g2b', false, ARRAY['company']::text[]),
  ('b2n', false, ARRAY['nonprofit']::text[]),
  ('b2e', false, ARRAY['company']::text[]),
  ('partners_distributors', false, ARRAY['company']::text[]),
  ('talent_recruiting', true, ARRAY['person', 'company']::text[]),
  ('investors_fundraising', true, ARRAY['company', 'person']::text[]),
  ('real_estate', true, ARRAY['property', 'listing', 'person', 'company']::text[]),
  ('local_business', false, ARRAY['company']::text[]),
  ('marketplace_sellers', true, ARRAY['company', 'creator']::text[]),
  ('distressed_insolvency', false, ARRAY['company']::text[]),
  ('business_succession', false, ARRAY['company']::text[]),
  ('events_exhibitors', true, ARRAY['company', 'person']::text[]),
  ('press_pr', true, ARRAY['person', 'creator']::text[]),
  ('procurement_sourcing', false, ARRAY['company']::text[]),
  ('regulated_professions', true, ARRAY['person', 'company']::text[]),
  ('education_institutions', false, ARRAY['public_buyer', 'nonprofit', 'company']::text[]);
