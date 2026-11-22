ALTER TABLE "invitations" DROP CONSTRAINT "invitations_role_valid";--> statement-breakpoint
ALTER TABLE "members" DROP CONSTRAINT "members_role_valid";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "platform_role" text;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_valid" CHECK ("invitations"."role" is null or "invitations"."role" in ('admin', 'manager', 'member', 'viewer', 'billing'));--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_role_valid" CHECK ("members"."role" in ('owner', 'admin', 'manager', 'member', 'viewer', 'billing'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_platform_role_valid" CHECK ("users"."platform_role" is null or "users"."platform_role" = 'operator');--> statement-breakpoint
-- Relu à la main : `platform_role` (opérateur plateforme, console SaaS prévue) n'est JAMAIS
-- modifiable par le service d'authentification ni par l'application : seul un administrateur de
-- la base (procédure d'exploitation) peut le poser. Déclencheur plutôt que privilèges par colonne
-- (Drizzle liste toutes les colonnes dans ses INSERT).
CREATE FUNCTION guard_platform_role() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF current_user IN ('scoutra_auth', 'scoutra_app') THEN
    IF TG_OP = 'INSERT' AND NEW.platform_role IS NOT NULL THEN
      RAISE EXCEPTION 'platform_role non modifiable' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.platform_role IS DISTINCT FROM OLD.platform_role THEN
      RAISE EXCEPTION 'platform_role non modifiable' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER users_platform_role_guard BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION guard_platform_role();
