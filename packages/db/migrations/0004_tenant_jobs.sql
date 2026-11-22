CREATE TYPE "public"."tenant_job_status" AS ENUM('queued', 'active', 'retrying', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "tenant_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" varchar(50) NOT NULL,
	"ref_type" varchar(50),
	"ref_id" uuid,
	"boss_job_id" uuid,
	"status" "tenant_job_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_code" varchar(100),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "tenant_jobs_org_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "tenant_jobs" ADD CONSTRAINT "tenant_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_jobs_org_ref_idx" ON "tenant_jobs" USING btree ("organization_id","ref_type","ref_id");--> statement-breakpoint
CREATE INDEX "tenant_jobs_org_status_idx" ON "tenant_jobs" USING btree ("organization_id","status");--> statement-breakpoint
-- Relu à la main : RLS FORCE comme toute table métier.
ALTER TABLE tenant_jobs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tenant_jobs FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON tenant_jobs FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON tenant_jobs TO scoutra_app;
