import type { L } from './types';

/**
 * Données de démonstration de l'espace de travail. Besoins d'API correspondants :
 * - GET /api/credits (solde, octroi, report, packs) et GET /api/billing (carte, factures)
 * - GET /api/campaigns, GET /api/campaigns/:id/events (déroulé des agents en direct, SSE)
 * - GET /api/saved-searches (+ alertes), GET /api/signals, GET/POST /api/automations
 * - GET /api/sequences, GET /api/inbox/threads, GET/POST /api/tasks
 * - GET /api/exports, POST /api/exports ; GET /api/compliance/{suppressions,erasure,audit,rules}
 * - GET /api/integrations, GET/POST/DELETE /api/api-keys ; GET /api/reports?range=
 */
const R = (fr: string, en: string = fr): L => ({ fr, en });

export const DEMO_CREDITS = { plan: 'pipeline' as const, granted: 3000, rollover: 410, packs: 500, used: 2186, renewsOn: '2026-12-01', seats: 5, seatsIncluded: 3 };

export const DEMO_CAMPAIGNS = [
  { id: 'c1', name: R('Cabinets dentaires sans réservation en ligne', 'Dental practices without online booking'), status: 'running', progress: 0.72, delivered: 41, credits: 41, replyRate: 0.22, owner: 'Sofia Rossi', created: R('aujourd’hui 10:42', 'today 10:42'), countries: ['FR', 'CA', 'US', 'PT'], model: 'b2b', kind: 'companies' },
  { id: 'c2', name: R('Distributeurs de matériel agricole, Europe de l’Est', 'Farm equipment distributors, Eastern Europe'), status: 'running', progress: 0.38, delivered: 27, credits: 27, replyRate: 0.18, owner: 'Kenji Watanabe', created: R('aujourd’hui 09:15', 'today 09:15'), countries: ['PL', 'RO', 'HU'], model: 'partners_distributors', kind: 'companies' },
  { id: 'c3', name: R('Fintech qui recrutent à Berlin et Amsterdam', 'Fintechs hiring in Berlin and Amsterdam'), status: 'done', progress: 1, delivered: 64, credits: 64, replyRate: 0.31, owner: 'Sofia Rossi', created: R('hier', 'yesterday'), countries: ['DE', 'NL'], model: 'talent_recruiting', kind: 'companies' },
  { id: 'c4', name: R('Fondations qui financent l’accès à l’eau', 'Foundations funding water access'), status: 'done', progress: 1, delivered: 23, credits: 23, replyRate: 0.26, owner: 'Léa Martin', created: R('18 nov.', 'Nov 18'), countries: ['WORLD'], model: 'b2n', kind: 'both' },
  { id: 'c5', name: R('Cabinets comptables au Royaume-Uni', 'Accounting firms in the UK'), status: 'paused', progress: 0.55, delivered: 88, credits: 88, replyRate: 0.14, owner: 'Amara Okafor', created: R('15 nov.', 'Nov 15'), countries: ['GB'], model: 'b2b', kind: 'companies' },
  { id: 'c6', name: R('Photographes de mariage, Texas', 'Wedding photographers, Texas'), status: 'done', progress: 1, delivered: 37, credits: 37, replyRate: 0.35, owner: 'Sofia Rossi', created: R('12 nov.', 'Nov 12'), countries: ['US'], model: 'b2c', kind: 'people' },
] as const;

export const DEMO_SAVED_SEARCHES = [
  { id: 's1', name: R('Cabinets dentaires récents'), query: R('Cabinets dentaires privés ouverts depuis moins d’un an, sans prise de rendez-vous en ligne', 'Private dental practices opened less than a year ago, no online booking'), countries: ['FR', 'CA', 'US', 'PT'], lastRun: R('aujourd’hui', 'today'), results: 41, fresh: 6, alert: true, owner: 'Sofia Rossi' },
  { id: 's2', name: R('Distributeurs agricoles', 'Farm distributors'), query: R('Distributeurs de matériel agricole en Pologne, Roumanie et Hongrie', 'Farm equipment distributors in Poland, Romania and Hungary'), countries: ['PL', 'RO', 'HU'], lastRun: R('aujourd’hui', 'today'), results: 27, fresh: 27, alert: true, owner: 'Kenji Watanabe' },
  { id: 's3', name: R('Fintech qui recrutent', 'Fintechs hiring'), query: R('Start-up fintech qui ont levé des fonds en 2026 et recrutent des développeurs', 'Fintech start-ups that raised in 2026 and are hiring developers'), countries: ['DE', 'NL', 'GB'], lastRun: R('hier', 'yesterday'), results: 64, fresh: 3, alert: true, owner: 'Sofia Rossi' },
  { id: 's4', name: R('Appels d’offres textile', 'Textile tenders'), query: R('Collectivités qui publient des appels d’offres sur le recyclage textile', 'Public bodies publishing textile recycling tenders'), countries: ['FR', 'IE', 'BE'], lastRun: R('20 nov.', 'Nov 20'), results: 12, fresh: 0, alert: false, owner: 'James Carter' },
  { id: 's5', name: R('Restaurants sans site mobile', 'Restaurants without a mobile site'), query: R('Restaurants avec plus de 200 avis et un site non adapté au mobile', 'Restaurants with over 200 reviews and a non-mobile website'), countries: ['PT', 'ES'], lastRun: R('17 nov.', 'Nov 17'), results: 58, fresh: 0, alert: false, owner: 'Amara Okafor' },
] as const;

export const DEMO_SIGNALS = [
  { id: 'g1', type: 'funding', org: 'Kitepay', cc: 'DE', when: R('il y a 2 h', '2 h ago'), day: 'today', text: R('Levée de 12 M€ (série A) annoncée sur le site de l’entreprise', '€12M Series A announced on the company website'), source: 'kitepay.example/press' },
  { id: 'g2', type: 'hiring', org: 'Tulip Fintech BV', cc: 'NL', when: R('il y a 3 h', '3 h ago'), day: 'today', text: R('5 offres d’emploi de développeurs publiées cette semaine', '5 developer job offers posted this week'), source: 'tulip.example/careers' },
  { id: 'g3', type: 'tender', org: 'Dublin City Council', cc: 'IE', when: R('il y a 5 h', '5 h ago'), day: 'today', text: R('Appel d’offres : collecte et recyclage des textiles, 420 000 €', 'Tender: textile collection and recycling, €420,000'), source: 'TED 2026/S 224-118' },
  { id: 'g4', type: 'creation', org: 'Clínica Dentária Alfama', cc: 'PT', when: R('hier', 'yesterday'), day: 'yesterday', text: R('Nouvelle société immatriculée, activité : cabinet dentaire', 'New company registered, activity: dental practice'), source: 'OpenCorporates' },
  { id: 'g5', type: 'move', org: 'Lumen Ledger Ltd', cc: 'GB', when: R('hier', 'yesterday'), day: 'yesterday', text: R('Changement de siège : nouveaux bureaux à Londres (Shoreditch)', 'Registered office moved: new offices in London (Shoreditch)'), source: 'Companies House' },
  { id: 'g6', type: 'reviews', org: 'La Mesa de Lapa', cc: 'PT', when: R('hier', 'yesterday'), day: 'yesterday', text: R('Passe le cap des 300 avis ; site toujours non adapté au mobile', 'Passes 300 reviews; website still not mobile-friendly'), source: 'Google Places' },
  { id: 'g7', type: 'hiring', org: 'Brennwerk Maschinenbau GmbH', cc: 'DE', when: R('20 nov.', 'Nov 20'), day: 'earlier', text: R('Recrute un acheteur international (emballages)', 'Hiring an international buyer (packaging)'), source: 'brennwerk.example/jobs' },
  { id: 'g8', type: 'funding', org: 'Kirana Cloud', cc: 'IN', when: R('19 nov.', 'Nov 19'), day: 'earlier', text: R('Levée de 3 M$ (amorçage)', '$3M seed round'), source: 'kirana.example/blog' },
] as const;

export const DEMO_ALERTS = [
  { id: 'a1', name: R('Levées de fonds fintech, Europe', 'Fintech funding, Europe'), types: ['funding'], on: true, hits: 14 },
  { id: 'a2', name: R('Appels d’offres recyclage', 'Recycling tenders'), types: ['tender'], on: true, hits: 3 },
  { id: 'a3', name: R('Créations de cabinets dentaires', 'New dental practices'), types: ['creation'], on: true, hits: 22 },
  { id: 'a4', name: R('Recrutements d’acheteurs', 'Buyer hiring'), types: ['hiring'], on: false, hits: 7 },
] as const;

export const DEMO_TASKS = [
  { id: 't1', title: R('Relance 2 par WhatsApp', 'Follow-up 2 via WhatsApp'), prospect: 'p006', type: 'whatsapp', due: 'overdue', time: R('hier', 'yesterday'), owner: 'Kenji Watanabe', done: false },
  { id: 't2', title: R('Confirmer le rendez-vous', 'Confirm the meeting'), prospect: 'p001', type: 'meeting', due: 'today', time: R('09:30'), owner: 'Sofia Rossi', done: false },
  { id: 't3', title: R('Envoyer le devis', 'Send the quote'), prospect: 'p005', type: 'email', due: 'today', time: R('11:00'), owner: 'Kenji Watanabe', done: false },
  { id: 't4', title: R('Relance 1 par téléphone', 'Follow-up 1 by phone'), prospect: 'p008', type: 'call', due: 'today', time: R('14:00'), owner: 'Amara Okafor', done: false },
  { id: 't5', title: R('Préparer la démonstration', 'Prepare the demo'), prospect: 'p014', type: 'meeting', due: 'today', time: R('16:30'), owner: 'James Carter', done: true },
  { id: 't6', title: R('Premier message', 'First message'), prospect: 'p004', type: 'email', due: 'tomorrow', time: R('10:00'), owner: 'James Carter', done: false },
  { id: 't7', title: R('Appeler la directrice', 'Call the director'), prospect: 'p002', type: 'call', due: 'tomorrow', time: R('15:00'), owner: 'Sofia Rossi', done: false },
  { id: 't8', title: R('Relance 1 par email', 'Follow-up 1 by email'), prospect: 'p022', type: 'email', due: 'later', time: R('lun. 25 nov.', 'Mon Nov 25'), owner: 'Kenji Watanabe', done: false },
  { id: 't9', title: R('Envoyer la proposition', 'Send the proposal'), prospect: 'p029', type: 'email', due: 'later', time: R('mar. 26 nov.', 'Tue Nov 26'), owner: 'James Carter', done: false },
] as const;

export const DEMO_AGENDA = [
  { day: 0, start: 9.5, end: 10, title: R('Rendez-vous : Cabinet Confluence', 'Meeting: Confluence practice'), who: 'Sofia Rossi' },
  { day: 0, start: 14, end: 14.5, title: R('Appel : Osei & Partners', 'Call: Osei & Partners'), who: 'Amara Okafor' },
  { day: 1, start: 11, end: 12, title: R('Démonstration : Brennwerk', 'Demo: Brennwerk'), who: 'Kenji Watanabe' },
  { day: 2, start: 10, end: 10.5, title: R('Point d’équipe', 'Team check-in'), who: 'James Carter' },
  { day: 2, start: 15, end: 16, title: R('Rendez-vous : Gestion Mont-Royal', 'Meeting: Gestion Mont-Royal'), who: 'James Carter' },
  { day: 3, start: 9, end: 9.5, title: R('Appel : Agromec', 'Call: Agromec'), who: 'Kenji Watanabe' },
  { day: 4, start: 13.5, end: 14.5, title: R('Démonstration : Riverside School', 'Demo: Riverside School'), who: 'James Carter' },
] as const;

export const DEMO_THREADS = [
  { id: 'th1', prospect: 'p002', channel: 'email', unread: true, when: R('09:12'), subject: R('Re : Une idée pour Clinique Dentaire Rosemont', 'Re: An idea for Clinique Dentaire Rosemont'), preview: R('Bonjour, merci pour votre message. Nous cherchons justement une solution pour…', 'Hello, thanks for your message. We are actually looking for a solution to…'), messages: [
    { from: 'me', when: R('lun. 08:40', 'Mon 08:40'), body: R('Bonjour Émilie, j’ai vu que vos patients réservent encore par téléphone. Auriez-vous 15 minutes cette semaine ?', 'Hi Émilie, I noticed your patients still book by phone. Would you have 15 minutes this week?') },
    { from: 'them', when: R('09:12'), body: R('Bonjour, merci pour votre message. Nous cherchons justement une solution pour réduire les absences. Pouvez-vous m’envoyer une présentation et des tarifs ?', 'Hello, thanks for your message. We are actually looking for a way to reduce no-shows. Could you send me a presentation and pricing?') },
  ], draft: R('Bonjour Émilie, merci pour votre retour. Je vous joins notre présentation (2 pages) et la grille tarifaire. Seriez-vous disponible jeudi à 10 h ou vendredi à 14 h pour un échange de 15 minutes ?', 'Hi Émilie, thanks for getting back to me. Please find attached our 2-page presentation and pricing. Would Thursday at 10am or Friday at 2pm work for a 15-minute call?') },
  { id: 'th2', prospect: 'p006', channel: 'whatsapp', unread: true, when: R('08:47'), subject: R('WhatsApp Business'), preview: R('Ciao, interessante. Possiamo sentirci la prossima settimana?', 'Ciao, interessante. Possiamo sentirci la prossima settimana?'), messages: [
    { from: 'me', when: R('ven. 16:05', 'Fri 16:05'), body: R('Buongiorno Marco, cerchiamo distributori in Italia per la nostra gamma di attrezzature. Le interessa ricevere il catalogo?', 'Buongiorno Marco, cerchiamo distributori in Italia per la nostra gamma di attrezzature. Le interessa ricevere il catalogo?') },
    { from: 'them', when: R('08:47'), body: R('Ciao, interessante. Possiamo sentirci la prossima settimana?', 'Ciao, interessante. Possiamo sentirci la prossima settimana?') },
  ], draft: R('Certo Marco, martedì alle 11 o mercoledì alle 15 le va bene?', 'Certo Marco, martedì alle 11 o mercoledì alle 15 le va bene?') },
  { id: 'th3', prospect: 'p011', channel: 'email', unread: false, when: R('hier', 'yesterday'), subject: R('Re : Recrutement de développeurs', 'Re: Developer hiring'), preview: R('Thanks, we are hiring 5 engineers in Q1. Happy to talk.', 'Thanks, we are hiring 5 engineers in Q1. Happy to talk.'), messages: [
    { from: 'me', when: R('mar. 10:00', 'Tue 10:00'), body: R('Hi Ethan, congrats on the Series A. We place senior engineers in Berlin within 30 days.', 'Hi Ethan, congrats on the Series A. We place senior engineers in Berlin within 30 days.') },
    { from: 'them', when: R('hier', 'yesterday'), body: R('Thanks, we are hiring 5 engineers in Q1. Happy to talk.', 'Thanks, we are hiring 5 engineers in Q1. Happy to talk.') },
  ], draft: R('Great to hear, Ethan. Would Wednesday 3pm CET work for a 20-minute call?', 'Great to hear, Ethan. Would Wednesday 3pm CET work for a 20-minute call?') },
  { id: 'th4', prospect: 'p022', channel: 'email', unread: false, when: R('20 nov.', 'Nov 20'), subject: R('Re : Distribution en Pologne', 'Re: Distribution in Poland'), preview: R('Dzień dobry, please send the price list for 2027.', 'Dzień dobry, please send the price list for 2027.'), messages: [
    { from: 'them', when: R('20 nov.', 'Nov 20'), body: R('Dzień dobry, please send the price list for 2027.', 'Dzień dobry, please send the price list for 2027.') },
  ], draft: R('Hello Natalia, here is our 2027 price list. Volume discounts start at 20 units.', 'Hello Natalia, here is our 2027 price list. Volume discounts start at 20 units.') },
  { id: 'th5', prospect: 'p014', channel: 'phone', unread: false, when: R('19 nov.', 'Nov 19'), subject: R('Note d’appel', 'Call note'), preview: R('Intéressée, réunion du conseil le 3 décembre. Rappeler le 4.', 'Interested, board meeting on 3 December. Call back on the 4th.'), messages: [
    { from: 'note', when: R('19 nov.', 'Nov 19'), body: R('Intéressée, réunion du conseil le 3 décembre. Rappeler le 4.', 'Interested, board meeting on 3 December. Call back on the 4th.') },
  ], draft: null },
] as const;

export const DEMO_SEQUENCES = [
  { id: 'q1', name: R('Cabinets de santé, 4 étapes', 'Health practices, 4 steps'), enrolled: 86, active: 41, replyRate: 0.24, owner: 'Sofia Rossi', steps: [
    { day: 0, channel: 'email', title: R('Premier message', 'First message'), sent: 86, replies: 9 },
    { day: 3, channel: 'email', title: R('Relance courte', 'Short follow-up'), sent: 71, replies: 7 },
    { day: 6, channel: 'phone', title: R('Appel', 'Call'), sent: 52, replies: 4 },
    { day: 10, channel: 'whatsapp', title: R('Message WhatsApp professionnel', 'Business WhatsApp message'), sent: 30, replies: 1 },
  ] },
  { id: 'q2', name: R('Distributeurs, 3 étapes', 'Distributors, 3 steps'), enrolled: 54, active: 33, replyRate: 0.19, owner: 'Kenji Watanabe', steps: [
    { day: 0, channel: 'email', title: R('Présentation et catalogue', 'Intro and catalogue'), sent: 54, replies: 6 },
    { day: 4, channel: 'email', title: R('Relance avec conditions', 'Follow-up with terms'), sent: 44, replies: 3 },
    { day: 9, channel: 'phone', title: R('Appel', 'Call'), sent: 25, replies: 1 },
  ] },
  { id: 'q3', name: R('Fondations, 2 étapes', 'Foundations, 2 steps'), enrolled: 23, active: 12, replyRate: 0.26, owner: 'Léa Martin', steps: [
    { day: 0, channel: 'email', title: R('Proposition de partenariat', 'Partnership proposal'), sent: 23, replies: 4 },
    { day: 7, channel: 'email', title: R('Relance avec étude d’impact', 'Follow-up with impact study'), sent: 18, replies: 2 },
  ] },
] as const;

export const DEMO_AUTOMATIONS = [
  { id: 'r1', trigger: 'replied', triggerArg: '', action: 'move_stage', actionArg: 'replied', on: true, runs: 61, last: R('il y a 2 h', '2 h ago') },
  { id: 'r2', trigger: 'score_above', triggerArg: '85', action: 'assign', actionArg: 'James Carter', on: true, runs: 38, last: R('il y a 4 h', '4 h ago') },
  { id: 'r3', trigger: 'signal', triggerArg: 'funding', action: 'create_task', actionArg: '', on: true, runs: 14, last: R('hier', 'yesterday') },
  { id: 'r4', trigger: 'task_overdue', triggerArg: '2', action: 'notify', actionArg: 'manager', on: true, runs: 9, last: R('hier', 'yesterday') },
  { id: 'r5', trigger: 'stage_changed', triggerArg: 'won', action: 'add_to_list', actionArg: 'Clients 2026', on: false, runs: 18, last: R('12 nov.', 'Nov 12') },
] as const;

export const DEMO_EXPORTS = [
  { id: 'e1', name: R('Cabinets dentaires, score ≥ 80', 'Dental practices, score ≥ 80'), format: 'xlsx', rows: 24, by: 'Sofia Rossi', when: R('aujourd’hui 11:20', 'today 11:20'), status: 'ready' },
  { id: 'e2', name: R('Fintech qui recrutent', 'Fintechs hiring'), format: 'csv', rows: 64, by: 'James Carter', when: R('hier 17:02', 'yesterday 17:02'), status: 'ready' },
  { id: 'e3', name: R('Pipeline complet', 'Full pipeline'), format: 'xlsx', rows: 312, by: 'Léa Martin', when: R('18 nov. 09:41', 'Nov 18 09:41'), status: 'ready' },
  { id: 'e4', name: R('Distributeurs agricoles', 'Farm distributors'), format: 'csv', rows: 27, by: 'Kenji Watanabe', when: R('à l’instant', 'just now'), status: 'running' },
  { id: 'e5', name: R('Liste importée par erreur', 'List imported by mistake'), format: 'csv', rows: 0, by: 'Amara Okafor', when: R('12 nov. 15:12', 'Nov 12 15:12'), status: 'expired' },
] as const;

export const DEMO_SUPPRESSIONS = [
  { id: 'x1', value: 'contact@sorriso-lapa.example', type: 'email', reason: R('Demande de désinscription', 'Unsubscribe request'), when: R('21 nov.', 'Nov 21'), by: 'Système', scope: R('Toute l’organisation', 'Whole organisation') },
  { id: 'x2', value: 'fischer-dachbau.example', type: 'domain', reason: R('Client existant', 'Existing customer'), when: R('19 nov.', 'Nov 19'), by: 'Amara Okafor', scope: R('Toute l’organisation', 'Whole organisation') },
  { id: 'x3', value: '+33 6•• •• •• 12', type: 'phone', reason: R('Opposition par téléphone', 'Objection by phone'), when: R('14 nov.', 'Nov 14'), by: 'Sofia Rossi', scope: R('Toute l’organisation', 'Whole organisation') },
  { id: 'x4', value: 'press@tokyo-design.example', type: 'email', reason: R('Adresse générique refusée', 'Generic address refused'), when: R('10 nov.', 'Nov 10'), by: 'Léa Martin', scope: R('Campagne presse', 'Press campaign') },
] as const;

export const DEMO_ERASURE = [
  { id: 'd1', requester: 'n•••@rivera-holdings.example', received: R('21 nov.', 'Nov 21'), deadline: R('21 déc.', 'Dec 21'), daysLeft: 29, status: 'open' },
  { id: 'd2', requester: 'm•••@taller-textil.example', received: R('8 nov.', 'Nov 8'), deadline: R('8 déc.', 'Dec 8'), daysLeft: 16, status: 'in_progress' },
  { id: 'd3', requester: 't•••@centre-dentaire.example', received: R('2 nov.', 'Nov 2'), deadline: R('2 déc.', 'Dec 2'), daysLeft: 0, status: 'done' },
] as const;

export const DEMO_AUDIT = [
  { id: 'l1', when: '2026-11-22 11:20', actor: 'Sofia Rossi', action: 'prospect.export', target: R('Export « Cabinets dentaires, score ≥ 80 » (24 lignes)', 'Export “Dental practices, score ≥ 80” (24 rows)'), ip: '91.168.•••.•••' },
  { id: 'l2', when: '2026-11-22 10:42', actor: 'Sofia Rossi', action: 'campaign.create', target: R('Campagne « Cabinets dentaires sans réservation en ligne »', 'Campaign “Dental practices without online booking”'), ip: '91.168.•••.•••' },
  { id: 'l3', when: '2026-11-22 09:03', actor: 'Léa Martin', action: 'member.invite', target: R('Invitation de nina@northwind.example (billing)', 'Invited nina@northwind.example (billing)'), ip: '82.64.•••.•••' },
  { id: 'l4', when: '2026-11-21 18:30', actor: 'Système', action: 'suppression.add', target: R('Désinscription de contact@sorriso-lapa.example', 'Unsubscribe of contact@sorriso-lapa.example'), ip: '—' },
  { id: 'l5', when: '2026-11-21 16:12', actor: 'Léa Martin', action: 'apikey.create', target: R('Clé API « Synchronisation CRM »', 'API key “CRM sync”'), ip: '82.64.•••.•••' },
  { id: 'l6', when: '2026-11-21 08:55', actor: 'James Carter', action: 'member.role_change', target: R('Amara Okafor : membre → membre', 'Amara Okafor: member → member'), ip: '86.12.•••.•••' },
] as const;

export const DEMO_INTEGRATIONS = [
  { id: 'hubspot', group: 'crm', name: 'HubSpot', status: 'connected', detail: R('Synchronisation toutes les 15 min, 312 fiches', 'Syncs every 15 min, 312 records') },
  { id: 'salesforce', group: 'crm', name: 'Salesforce', status: 'available', detail: R('Comptes, contacts et opportunités', 'Accounts, contacts and opportunities') },
  { id: 'pipedrive', group: 'crm', name: 'Pipedrive', status: 'available', detail: R('Personnes, organisations et affaires', 'People, organisations and deals') },
  { id: 'gmail', group: 'email', name: 'Gmail / Google Workspace', status: 'connected', detail: R('lea@northwind.example, brouillons et suivi des réponses', 'lea@northwind.example, drafts and reply tracking') },
  { id: 'outlook', group: 'email', name: 'Microsoft 365 / Outlook', status: 'available', detail: R('Brouillons et suivi des réponses', 'Drafts and reply tracking') },
  { id: 'whatsapp', group: 'messaging', name: 'WhatsApp Business', status: 'attention', detail: R('Numéro à revalider avant le 30 nov.', 'Number must be re-validated before Nov 30') },
  { id: 'gcal', group: 'calendar', name: 'Google Agenda', status: 'connected', detail: R('Rendez-vous créés depuis le pipeline', 'Meetings created from the pipeline') },
  { id: 'hunter', group: 'data', name: 'Hunter', status: 'available', detail: R('Vos propres crédits (clé du client)', 'Your own credits (customer key)') },
  { id: 'apollo', group: 'data', name: 'Apollo', status: 'available', detail: R('Vos propres crédits (clé du client)', 'Your own credits (customer key)') },
] as const;

export const DEMO_API_KEYS = [
  { id: 'k1', name: R('Synchronisation CRM', 'CRM sync'), prefix: 'sk_live_', last4: '3f9a', created: R('21 nov.', 'Nov 21'), lastUsed: R('il y a 4 min', '4 min ago'), scopes: 'prospects:read' },
  { id: 'k2', name: R('Import site web', 'Website import'), prefix: 'sk_live_', last4: 'b71c', created: R('2 nov.', 'Nov 2'), lastUsed: R('hier', 'yesterday'), scopes: 'prospects:write' },
] as const;

export const DEMO_INVOICES = [
  { id: 'INV-2026-011', date: R('1 nov. 2026', 'Nov 1, 2026'), amount: 69.97, status: 'paid' },
  { id: 'INV-2026-010', date: R('15 oct. 2026', 'Oct 15, 2026'), amount: 59, status: 'paid' },
  { id: 'INV-2026-009', date: R('1 oct. 2026', 'Oct 1, 2026'), amount: 69.97, status: 'paid' },
  { id: 'INV-2026-008', date: R('1 sept. 2026', 'Sep 1, 2026'), amount: 49.99, status: 'paid' },
] as const;

/** Rapports (90 jours). */
export const DEMO_REPORTS = {
  funnel: [
    { stage: 'new', n: 754 },
    { stage: 'contacted', n: 310 },
    { stage: 'replied', n: 61 },
    { stage: 'meeting', n: 29 },
    { stage: 'won', n: 18 },
  ],
  channels: [
    { channel: 'phone', rate: 0.34 },
    { channel: 'whatsapp', rate: 0.27 },
    { channel: 'email', rate: 0.11 },
    { channel: 'linkedin_manual', rate: 0.09 },
  ],
  countries: [
    { cc: 'FR', n: 168 }, { cc: 'US', n: 131 }, { cc: 'GB', n: 102 }, { cc: 'DE', n: 88 }, { cc: 'CA', n: 74 }, { cc: 'PT', n: 51 }, { cc: 'ES', n: 39 }, { cc: 'PL', n: 31 },
  ],
  weekly: [
    { w: '02/09', delivered: 38, meetings: 1 }, { w: '09/09', delivered: 44, meetings: 2 }, { w: '16/09', delivered: 41, meetings: 1 }, { w: '23/09', delivered: 52, meetings: 2 },
    { w: '30/09', delivered: 58, meetings: 3 }, { w: '07/10', delivered: 61, meetings: 2 }, { w: '14/10', delivered: 55, meetings: 2 }, { w: '21/10', delivered: 67, meetings: 3 },
    { w: '28/10', delivered: 72, meetings: 3 }, { w: '04/11', delivered: 69, meetings: 2 }, { w: '11/11', delivered: 81, meetings: 4 }, { w: '18/11', delivered: 96, meetings: 4 },
  ],
  credits: [
    { d: '01/11', used: 96 }, { d: '04/11', used: 241 }, { d: '07/11', used: 402 }, { d: '10/11', used: 655 }, { d: '13/11', used: 980 }, { d: '16/11', used: 1311 }, { d: '19/11', used: 1802 }, { d: '22/11', used: 2186 },
  ],
};

/** Activité récente des agents (accueil). */
export const DEMO_AGENT_FEED = [
  { when: '11:24', agent: 'write', text: R('8 messages prêts pour « Cabinets dentaires sans réservation en ligne »', '8 messages ready for “Dental practices without online booking”') },
  { when: '11:21', agent: 'verify', text: R('132 contacts testés : 118 valides, 9 à confirmer, 5 rejetés', '132 contacts tested: 118 valid, 9 to confirm, 5 rejected') },
  { when: '11:08', agent: 'enrich', text: R('171 sites lus pour « Distributeurs de matériel agricole »', '171 websites read for “Farm equipment distributors”') },
  { when: '10:55', agent: 'search', text: R('286 établissements trouvés dans 5 sources', '286 businesses found in 5 sources') },
  { when: '10:42', agent: 'interpret', text: R('Fiche cible prête : cabinet dentaire privé, 4 villes, ouverture après nov. 2025', 'Target ready: private dental practice, 4 cities, opened after Nov 2025') },
  { when: '09:16', agent: 'score', text: R('27 prospects notés, meilleur score : 91', '27 prospects scored, best score: 91') },
] as const;
