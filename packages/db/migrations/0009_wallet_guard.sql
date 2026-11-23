-- Relu à la main (revue étape 2, constat 18, atténuation) : dans un portefeuille de crédits,
-- seul le solde restant peut évoluer ; origine, montant octroyé, expiration et référence sont
-- figés après création (une injection SQL côté application ne peut ni prolonger ni gonfler un
-- portefeuille). Idem pour les réservations : seul le montant remboursé évolue, à la hausse.
CREATE FUNCTION guard_credit_bucket() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF NEW.origin IS DISTINCT FROM OLD.origin OR NEW.granted_mc IS DISTINCT FROM OLD.granted_mc
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR NEW.ref IS DISTINCT FROM OLD.ref
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'portefeuille de crédits : seul le solde peut changer' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER credit_buckets_guard BEFORE UPDATE ON credit_buckets FOR EACH ROW EXECUTE FUNCTION guard_credit_bucket();
--> statement-breakpoint
CREATE FUNCTION guard_credit_reservation() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF NEW.reserved_mc IS DISTINCT FROM OLD.reserved_mc OR NEW.bucket_id IS DISTINCT FROM OLD.bucket_id
     OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id OR NEW.refunded_mc < OLD.refunded_mc THEN
    RAISE EXCEPTION 'réservation : seul le remboursement peut augmenter' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER credit_reservations_guard BEFORE UPDATE ON credit_reservations FOR EACH ROW EXECUTE FUNCTION guard_credit_reservation();
--> statement-breakpoint
REVOKE DELETE ON credit_buckets, credit_reservations FROM scoutra_app;
