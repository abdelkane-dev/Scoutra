ALTER TABLE "organizations" ADD COLUMN "account_type" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "sectors" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_account_type_format" CHECK ("organizations"."account_type" is null or "organizations"."account_type" ~ '^[a-z_]{2,40}$');--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_sectors_max" CHECK (cardinality("organizations"."sectors") <= 10);--> statement-breakpoint
-- Relu à la main : l'application (scoutra_app) peut mettre à jour UNIQUEMENT le profil
-- (type de compte, secteurs) de l'organisation courante. Le pays reste figé.
GRANT UPDATE (account_type, sectors) ON organizations TO scoutra_app;
--> statement-breakpoint
CREATE POLICY tenant_profile_update ON organizations FOR UPDATE TO scoutra_app
  USING (id = app_current_org_id())
  WITH CHECK (id = app_current_org_id());
