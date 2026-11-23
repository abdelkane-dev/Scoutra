-- Relu à la main : l'historique d'un prospect reste non modifiable, mais il doit pouvoir être
-- SUPPRIMÉ avec le prospect lors d'un effacement (droit à l'effacement, suppression en cascade).
DROP TRIGGER prospect_activities_append_only ON prospect_activities;
--> statement-breakpoint
CREATE TRIGGER prospect_activities_no_update BEFORE UPDATE ON prospect_activities FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
