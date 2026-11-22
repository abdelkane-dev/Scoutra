# Données FICTIVES pour la maquette Recherche (Scoutra).
SIG = "Sofia Mendes\nRendezvo"
def mk(id, name, role, org, city, cc, country, source, email, mail, phone, site, reasons, hook, wa_hook, rule, date, title):
    first = name.split()[-1]
    msg = (f"Bonjour {title} {first},\n\n{hook} Rendezvo aide des cabinets comme le vôtre à proposer la prise de rendez-vous en ligne et à réduire les absences grâce aux rappels automatiques.\n\n"
           f"Auriez-vous 15 minutes jeudi ou vendredi pour en parler ?\n\nBien cordialement,\n{SIG}")
    wa = f"Bonjour {title} {first}, Sofia de Rendezvo. {wa_hook} Je peux vous expliquer en 2 minutes ?"
    return dict(id=id, name=name, role=role, org=org, city=city, cc=cc, country=country, source=source, email=email, mail=mail,
                phone=phone, site=site, reasons=reasons, subject=f"Rendez-vous en ligne pour {org}", msg=msg, wa=wa,
                basis="Intérêt légitime (B2B), information au premier contact", rule=rule, date=date)
P = [
 mk("p1","Dr Claire Fontaine","Fondatrice","Cabinet Dentaire Confluence","Lyon","FR","France","Registre des entreprises","c.fontaine@confluence-dentaire.example","ok","+33 4 00 00 01 01","confluence-dentaire.example",
    [("+30","Secteur exact : cabinet dentaire privé"),("+22","Fondatrice identifiée sur le site"),("+18","Cabinet ouvert il y a 4 mois"),("+14","Taille dans la cible : 6 praticiens"),("+10","Pas de prise de rendez-vous en ligne")],
    "Félicitations pour l'ouverture du Cabinet Confluence en juillet. J'ai vu que vos patients doivent encore appeler pour réserver.", "Votre cabinet a ouvert en juillet et les rendez-vous se prennent encore par téléphone.", "France : RGPD, CNIL","22/11/2026","Docteure"),
 mk("p2","Dr Youssef Alami","Gérant","Centre Dentaire Anfa","Casablanca","MA","Maroc","Google Places (API)","contact@anfa-dentaire.example","ok","+212 5 00 00 02 02","anfa-dentaire.example",
    [("+30","Secteur exact : cabinet dentaire privé"),("+20","Gérant identifié"),("+15","Nombreux avis récents"),("+14","Taille dans la cible : 9 salariés"),("+10","Pas de prise de rendez-vous en ligne")],
    "Votre centre a d'excellents avis, et plusieurs patients y mentionnent la difficulté à joindre l'accueil.", "Vos patients saluent votre centre mais disent avoir du mal à joindre l'accueil.", "Maroc : loi 09-08, CNDP","22/11/2026","Docteur"),
 mk("p3","Dr Émilie Gagnon","Copropriétaire","Clinique Dentaire Rosemont","Montréal","CA","Canada","Site web de l'entreprise","e.gagnon@cliniquerosemont.example","ok","+1 514 000 0303","cliniquerosemont.example",
    [("+28","Secteur exact : clinique dentaire"),("+22","Copropriétaire identifiée"),("+14","Site web actif"),("+12","Taille dans la cible : 14 salariés"),("+10","Recrute une ou un réceptionniste")],
    "J'ai vu que la Clinique Rosemont recrute pour sa réception.", "J'ai vu que vous recrutez pour la réception : un agenda en ligne pourrait vous soulager.", "Canada : LCAP, adresse pro publiée","22/11/2026","Docteure"),
 mk("p4","Dr Moussa Ndiaye","Directeur","Clinique Dentaire Almadies","Dakar","SN","Sénégal","OpenStreetMap et site web","direction@almadies-dentaire.example","ok","+221 33 000 04 04","almadies-dentaire.example",
    [("+30","Secteur exact : clinique dentaire"),("+20","Directeur identifié"),("+12","Site web actif"),("+10","Taille dans la cible : 11 salariés"),("+10","Pas de prise de rendez-vous en ligne")],
    "La Clinique Almadies accueille de plus en plus de patients d'après votre site.", "Nous aidons des cliniques à passer au rendez-vous en ligne.", "Sénégal : loi 2008-12, CDP","22/11/2026","Docteur"),
 mk("p5","Dr Sarah Peeters","Cogérante","Cabinet Sourire Ixelles","Bruxelles","BE","Belgique","Annuaire professionnel","","none","+32 2 000 05 05","sourire-ixelles.example",
    [("+30","Secteur exact : cabinet dentaire privé"),("+18","Cogérante identifiée"),("+15","Taille dans la cible : 5 praticiens"),("+14","WhatsApp professionnel affiché"),("0","Aucun email trouvé")],
    "Votre cabinet d'Ixelles a ouvert ce printemps.", "Votre WhatsApp professionnel est affiché sur votre site.", "Belgique : RGPD, APD","21/11/2026","Docteure"),
 mk("p6","Dr Thomas Girard","Directeur médical","Centre Dentaire Part-Dieu","Lyon","FR","France","Google Places (API)","t.girard@partdieu-dentaire.example","ok","+33 4 00 00 06 06","partdieu-dentaire.example",
    [("+24","Secteur exact : centre dentaire"),("+20","Directeur médical identifié"),("+12","Site web actif"),("+10","Taille dans la cible : 20 salariés"),("+8","Avis clients récents")],
    "Le Centre Part-Dieu reçoit beaucoup d'avis sur la difficulté à obtenir un créneau.", "Vos patients cherchent des créneaux plus facilement.", "France : RGPD, CNIL","21/11/2026","Docteur"),
 mk("p7","Dr Nadia Benali","Gérante","Cabinet Dentaire Maârif","Casablanca","MA","Maroc","Site web de l'entreprise","cabinet@maarif-dentaire.example","risky","+212 5 00 00 07 07","maarif-dentaire.example",
    [("+30","Secteur exact : cabinet dentaire privé"),("+16","Gérante identifiée"),("+12","Taille dans la cible : 4 salariés"),("+10","Pas de prise de rendez-vous en ligne"),("0","Email non confirmé : le domaine accepte tout")],
    "J'ai consulté le site du Cabinet Maârif.", "Nous aidons des cabinets à passer au rendez-vous en ligne.", "Maroc : loi 09-08, CNDP","21/11/2026","Docteure"),
 mk("p8","Dr Kevin Bouchard","Directeur","Clinique Dentaire Plateau","Montréal","CA","Canada","Registre des entreprises","k.bouchard@cliniqueplateau.example","ok","+1 514 000 0808","cliniqueplateau.example",
    [("+30","Secteur exact : clinique dentaire"),("+14","Directeur identifié"),("+9","Site web peu mis à jour"),("+10","Taille dans la cible : 16 salariés"),("0","Utilise déjà un agenda en ligne")],
    "J'ai vu que la Clinique Plateau propose déjà un agenda en ligne : nos rappels par SMS pourraient réduire vos absences.", "Nos rappels par SMS pourraient réduire vos absences.", "Canada : LCAP, adresse pro publiée","21/11/2026","Docteur"),
]
