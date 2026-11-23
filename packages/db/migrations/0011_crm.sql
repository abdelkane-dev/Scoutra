CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"trigger" varchar(30) NOT NULL,
	"trigger_arg" varchar(100) DEFAULT '' NOT NULL,
	"action" varchar(30) NOT NULL,
	"action_arg" varchar(200) DEFAULT '' NOT NULL,
	"runs" integer DEFAULT 0 NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_subject_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"subject_hash" char(64) NOT NULL,
	"subject_hint" varchar(120),
	"status" varchar(12) DEFAULT 'open' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"handled_by" uuid,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "dsr_type_valid" CHECK ("data_subject_requests"."type" in ('erasure', 'opposition', 'access', 'rectification')),
	CONSTRAINT "dsr_status_valid" CHECK ("data_subject_requests"."status" in ('open', 'in_progress', 'done', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "export_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"name" varchar(120) NOT NULL,
	"format" varchar(10) NOT NULL,
	"rows" integer NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" varchar(1000),
	"link" varchar(300),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" varchar(40) NOT NULL,
	"label_fr" varchar(60) NOT NULL,
	"label_en" varchar(60) NOT NULL,
	"position" integer NOT NULL,
	"kind" varchar(10) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_stages_org_key_unique" UNIQUE("organization_id","key"),
	CONSTRAINT "pipeline_stages_kind_valid" CHECK ("pipeline_stages"."kind" in ('open', 'won', 'lost')),
	CONSTRAINT "pipeline_stages_key_format" CHECK ("pipeline_stages"."key" ~ '^[a-z0-9_]{2,40}$')
);
--> statement-breakpoint
CREATE TABLE "prospect_activities" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "prospect_activities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"organization_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"type" varchar(40) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospect_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"list_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospect_list_items_unique" UNIQUE("organization_id","list_id","prospect_id")
);
--> statement-breakpoint
CREATE TABLE "prospect_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospect_lists_org_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "prospect_lists_org_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"alert" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequence_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sequence_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"step_index" integer DEFAULT 0 NOT NULL,
	"next_run_at" timestamp with time zone,
	"status" varchar(12) DEFAULT 'active' NOT NULL,
	"enrolled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sequence_enrollments_unique" UNIQUE("organization_id","sequence_id","prospect_id"),
	CONSTRAINT "sequence_enrollments_status_valid" CHECK ("sequence_enrollments"."status" in ('active', 'completed', 'stopped', 'replied'))
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"status" varchar(10) DEFAULT 'active' NOT NULL,
	"steps" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sequences_org_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "sequences_status_valid" CHECK ("sequences"."status" in ('active', 'paused', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "support_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"category" varchar(20) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"message" varchar(5000) NOT NULL,
	"status" varchar(12) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_category_valid" CHECK ("support_requests"."category" in ('question', 'bug', 'billing', 'privacy', 'other'))
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"prospect_id" uuid,
	"assignee_user_id" uuid,
	"title" varchar(200) NOT NULL,
	"kind" varchar(20) DEFAULT 'other' NOT NULL,
	"due_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"status" varchar(12) DEFAULT 'open' NOT NULL,
	"source" varchar(12) DEFAULT 'manual' NOT NULL,
	"enrollment_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "tasks_kind_valid" CHECK ("tasks"."kind" in ('call', 'email', 'whatsapp', 'meeting', 'follow_up', 'linkedin_manual', 'other')),
	CONSTRAINT "tasks_status_valid" CHECK ("tasks"."status" in ('open', 'done', 'cancelled')),
	CONSTRAINT "tasks_source_valid" CHECK ("tasks"."source" in ('manual', 'sequence', 'automation'))
);
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_status_valid";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "replied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "stage_key" varchar(40) DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "stage_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "value_amount" integer;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "qualification" varchar(20) DEFAULT 'unqualified' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppression_list" ADD COLUMN "value_kind" varchar(10) DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppression_list" ADD COLUMN "display_hint" varchar(120);--> statement-breakpoint
ALTER TABLE "suppression_list" ADD COLUMN "note" varchar(200);--> statement-breakpoint
ALTER TABLE "suppression_list" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_logs" ADD CONSTRAINT "export_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_activities" ADD CONSTRAINT "prospect_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_activities" ADD CONSTRAINT "prospect_activities_prospect_fk" FOREIGN KEY ("organization_id","prospect_id") REFERENCES "public"."prospects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_list_items" ADD CONSTRAINT "prospect_list_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_list_items" ADD CONSTRAINT "prospect_list_items_list_fk" FOREIGN KEY ("organization_id","list_id") REFERENCES "public"."prospect_lists"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_list_items" ADD CONSTRAINT "prospect_list_items_prospect_fk" FOREIGN KEY ("organization_id","prospect_id") REFERENCES "public"."prospects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_lists" ADD CONSTRAINT "prospect_lists_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_sequence_fk" FOREIGN KEY ("organization_id","sequence_id") REFERENCES "public"."sequences"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_prospect_fk" FOREIGN KEY ("organization_id","prospect_id") REFERENCES "public"."prospects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_prospect_fk" FOREIGN KEY ("organization_id","prospect_id") REFERENCES "public"."prospects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automations_org_trigger_idx" ON "automations" USING btree ("organization_id","trigger","enabled");--> statement-breakpoint
CREATE INDEX "data_subject_requests_org_status_idx" ON "data_subject_requests" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "export_logs_org_created_idx" ON "export_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_org_user_idx" ON "notifications" USING btree ("organization_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "prospect_activities_org_prospect_idx" ON "prospect_activities" USING btree ("organization_id","prospect_id","id");--> statement-breakpoint
CREATE INDEX "prospect_activities_org_created_idx" ON "prospect_activities" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "saved_searches_org_user_idx" ON "saved_searches" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "saved_views_org_user_idx" ON "saved_views" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "sequence_enrollments_due_idx" ON "sequence_enrollments" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE INDEX "tasks_org_assignee_idx" ON "tasks" USING btree ("organization_id","assignee_user_id","status","due_at");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_status_valid" CHECK ("messages"."status" in ('draft', 'approved', 'to_send', 'copied', 'sent_manually', 'replied', 'discarded'));--> statement-breakpoint
ALTER TABLE "suppression_list" ADD CONSTRAINT "suppression_list_kind_valid" CHECK ("suppression_list"."value_kind" in ('email', 'phone', 'domain'));
--> statement-breakpoint
-- Relu à la main : RLS FORCE + isolation par organisation sur chaque nouvelle table.
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE pipeline_stages FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON pipeline_stages FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON pipeline_stages TO scoutra_app;
ALTER TABLE prospect_activities ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE prospect_activities FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON prospect_activities FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON prospect_activities TO scoutra_app;
ALTER TABLE prospect_lists ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE prospect_lists FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON prospect_lists FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON prospect_lists TO scoutra_app;
ALTER TABLE prospect_list_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE prospect_list_items FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON prospect_list_items FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON prospect_list_items TO scoutra_app;
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE saved_views FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON saved_views FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_views TO scoutra_app;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE sequences FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON sequences FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON sequences TO scoutra_app;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE sequence_enrollments FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON sequence_enrollments FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON sequence_enrollments TO scoutra_app;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON tasks FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO scoutra_app;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE automations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON automations FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON automations TO scoutra_app;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON notifications FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO scoutra_app;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE saved_searches FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON saved_searches FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_searches TO scoutra_app;
ALTER TABLE data_subject_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE data_subject_requests FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON data_subject_requests FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON data_subject_requests TO scoutra_app;
ALTER TABLE export_logs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE export_logs FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON export_logs FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON export_logs TO scoutra_app;
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE support_requests FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON support_requests FOR ALL TO scoutra_app
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON support_requests TO scoutra_app;
GRANT USAGE ON SEQUENCE prospect_activities_id_seq TO scoutra_app;
--> statement-breakpoint
-- Historique, journal des exports : ajout seul.
CREATE TRIGGER prospect_activities_append_only BEFORE UPDATE OR DELETE ON prospect_activities FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER export_logs_append_only BEFORE UPDATE OR DELETE ON export_logs FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
-- Séquences : étapes dues, toutes organisations (identifiants seulement), pour le worker.
CREATE POLICY sweeper_read ON sequence_enrollments FOR SELECT TO scoutra_migrator USING (true);
--> statement-breakpoint
CREATE FUNCTION app_due_enrollments() RETURNS TABLE (organization_id uuid, enrollment_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT e.organization_id, e.id FROM sequence_enrollments e
     WHERE e.status = 'active' AND e.next_run_at <= now()
     ORDER BY e.next_run_at
     LIMIT 500
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_due_enrollments() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_due_enrollments() TO scoutra_app;
--> statement-breakpoint
-- Noms des membres de l'organisation COURANTE (affichage du propriétaire d'un prospect, des
-- auteurs). La table users n'est pas accessible au rôle applicatif : fonction dédiée, filtrée.
CREATE POLICY definer_read ON members FOR SELECT TO scoutra_migrator
  USING (organization_id = app_current_org_id());
--> statement-breakpoint
CREATE FUNCTION app_org_member_names() RETURNS TABLE (user_id uuid, name text, role text)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT u.id, u.name, m.role FROM members m JOIN users u ON u.id = m.user_id
     WHERE m.organization_id = app_current_org_id()
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_org_member_names() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_org_member_names() TO scoutra_app;
