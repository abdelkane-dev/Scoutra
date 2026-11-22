ALTER TYPE "public"."campaign_status" ADD VALUE 'awaiting_confirmation';--> statement-breakpoint
ALTER TYPE "public"."ledger_reason" ADD VALUE 'pack_purchase';--> statement-breakpoint
ALTER TYPE "public"."ledger_reason" ADD VALUE 'rollover';--> statement-breakpoint
ALTER TYPE "public"."ledger_reason" ADD VALUE 'expire';--> statement-breakpoint
CREATE TABLE "campaign_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campaign_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_buckets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"origin" varchar(20) NOT NULL,
	"granted_mc" bigint NOT NULL,
	"remaining_mc" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ref" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_buckets_org_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "credit_buckets_org_ref_unique" UNIQUE("organization_id","ref"),
	CONSTRAINT "credit_buckets_origin_valid" CHECK ("credit_buckets"."origin" in ('plan', 'rollover', 'pack', 'trial', 'adjustment')),
	CONSTRAINT "credit_buckets_amounts" CHECK ("credit_buckets"."remaining_mc" >= 0 and "credit_buckets"."remaining_mc" <= "credit_buckets"."granted_mc")
);
--> statement-breakpoint
CREATE TABLE "credit_consumptions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "credit_consumptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"prospect_id" uuid,
	"amount_mc" bigint NOT NULL,
	"idempotency_key" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_consumptions_idem_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "credit_consumptions_positive" CHECK ("credit_consumptions"."amount_mc" > 0)
);
--> statement-breakpoint
CREATE TABLE "credit_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"bucket_id" uuid NOT NULL,
	"reserved_mc" bigint NOT NULL,
	"refunded_mc" bigint DEFAULT 0 NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_reservations_amounts" CHECK ("credit_reservations"."refunded_mc" >= 0 and "credit_reservations"."refunded_mc" <= "credit_reservations"."reserved_mc")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"campaign_id" uuid,
	"channel" "contact_channel" NOT NULL,
	"language" varchar(5) NOT NULL,
	"subject" varchar(200),
	"body" varchar(4000) NOT NULL,
	"footer" varchar(1000) DEFAULT '' NOT NULL,
	"quality" varchar(20) DEFAULT 'standard' NOT NULL,
	"generated_by" varchar(20) NOT NULL,
	"model" varchar(100),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"compliance_decision" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_status_valid" CHECK ("messages"."status" in ('draft', 'approved', 'copied', 'sent_manually', 'discarded')),
	CONSTRAINT "messages_generated_by_valid" CHECK ("messages"."generated_by" in ('ai', 'template', 'user'))
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"provider" varchar(30) NOT NULL,
	"provider_ref" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_org_unique" UNIQUE("organization_id"),
	CONSTRAINT "subscriptions_plan_valid" CHECK ("subscriptions"."plan" in ('research', 'pipeline')),
	CONSTRAINT "subscriptions_status_valid" CHECK ("subscriptions"."status" in ('trialing', 'active', 'past_due', 'canceled'))
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "usage_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid,
	"kind" varchar(30) NOT NULL,
	"provider" varchar(60) NOT NULL,
	"source" varchar(60) NOT NULL,
	"units" integer DEFAULT 1 NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_micro_usd" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_events_kind_valid" CHECK ("usage_events"."kind" in ('llm', 'connector', 'verification', 'crawl')),
	CONSTRAINT "usage_events_cost_positive" CHECK ("usage_events"."cost_micro_usd" >= 0)
);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ALTER COLUMN "delta" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "quality" varchar(20) DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "model_forced" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "reserved_mc" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "consumed_mc" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "candidates_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "duplicates_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "delivered_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "rejected_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "degraded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "cost_mode" varchar(20) DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "estimate" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "sources" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "error_code" varchar(100);--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "score" smallint;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "score_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "channel_decisions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "source_codes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_campaign_fk" FOREIGN KEY ("organization_id","campaign_id") REFERENCES "public"."campaigns"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_buckets" ADD CONSTRAINT "credit_buckets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_consumptions" ADD CONSTRAINT "credit_consumptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_bucket_fk" FOREIGN KEY ("organization_id","bucket_id") REFERENCES "public"."credit_buckets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_prospect_fk" FOREIGN KEY ("organization_id","prospect_id") REFERENCES "public"."prospects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_events_org_campaign_idx" ON "campaign_events" USING btree ("organization_id","campaign_id","id");--> statement-breakpoint
CREATE INDEX "credit_buckets_org_expiry_idx" ON "credit_buckets" USING btree ("organization_id","expires_at");--> statement-breakpoint
CREATE INDEX "credit_reservations_org_campaign_idx" ON "credit_reservations" USING btree ("organization_id","campaign_id");--> statement-breakpoint
CREATE INDEX "messages_org_prospect_idx" ON "messages" USING btree ("organization_id","prospect_id");--> statement-breakpoint
CREATE INDEX "usage_events_org_created_idx" ON "usage_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_events_org_campaign_idx" ON "usage_events" USING btree ("organization_id","campaign_id");--> statement-breakpoint
CREATE INDEX "campaigns_org_status_idx" ON "campaigns" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "prospects_org_delivered_idx" ON "prospects" USING btree ("organization_id","delivered_at");--> statement-breakpoint
CREATE INDEX "prospects_org_owner_idx" ON "prospects" USING btree ("organization_id","owner_user_id");--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_quality_valid" CHECK ("campaigns"."quality" in ('standard', 'careful', 'premium'));--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_credits_consistent" CHECK ("campaigns"."consumed_mc" >= 0 and "campaigns"."reserved_mc" >= 0);--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_score_range" CHECK ("prospects"."score" is null or ("prospects"."score" >= 0 and "prospects"."score" <= 100));
--> statement-breakpoint
-- Relu à la main : RLS FORCE + politique d'isolation sur chaque nouvelle table métier.
ALTER TABLE campaign_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE campaign_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON campaign_events FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE usage_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON usage_events FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON messages FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
ALTER TABLE credit_buckets ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE credit_buckets FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON credit_buckets FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
ALTER TABLE credit_reservations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE credit_reservations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON credit_reservations FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
ALTER TABLE credit_consumptions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE credit_consumptions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON credit_consumptions FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON subscriptions FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
GRANT SELECT, INSERT ON campaign_events, usage_events, credit_consumptions TO scoutra_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO scoutra_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON credit_buckets, credit_reservations, subscriptions TO scoutra_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE campaign_events_id_seq, usage_events_id_seq, credit_consumptions_id_seq TO scoutra_app;
--> statement-breakpoint
-- Coûts réels et consommations : ajout seul (privilèges ET déclencheur).
CREATE TRIGGER usage_events_append_only BEFORE UPDATE OR DELETE ON usage_events FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER credit_consumptions_append_only BEFORE UPDATE OR DELETE ON credit_consumptions FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
-- Diffusion en direct : notification (identifiant seulement, jamais de donnée) sur le canal de
-- la campagne ; le web relit la ligne SOUS RLS.
CREATE FUNCTION notify_campaign_event() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  PERFORM pg_notify('scoutra_campaign_events', NEW.campaign_id::text || ':' || NEW.id::text);
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER campaign_events_notify AFTER INSERT ON campaign_events FOR EACH ROW EXECUTE FUNCTION notify_campaign_event();
