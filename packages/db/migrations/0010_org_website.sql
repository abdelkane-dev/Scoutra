ALTER TABLE "organizations" ADD COLUMN "website_domain" text;--> statement-breakpoint
-- Relu à la main : le profil modifiable par l'application inclut le site web.
GRANT UPDATE (website_domain) ON organizations TO scoutra_app;
