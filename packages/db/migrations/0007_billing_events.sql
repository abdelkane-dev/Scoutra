CREATE TABLE "billing_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "billing_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"organization_id" uuid NOT NULL,
	"event_id" varchar(200) NOT NULL,
	"type" varchar(50) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"outcome" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_events_org_event_unique" UNIQUE("organization_id","event_id")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "last_event_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Relu à la main : RLS FORCE ; ajout seul (privilèges ET déclencheur).
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE billing_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON billing_events FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON billing_events TO scoutra_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE billing_events_id_seq TO scoutra_app;
--> statement-breakpoint
CREATE TRIGGER billing_events_append_only BEFORE UPDATE OR DELETE ON billing_events FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
