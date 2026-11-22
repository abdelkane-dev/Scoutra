import type { DemoProspect, EmailStatus, L, Stage } from './types';

/**
 * Besoins d'API : GET /api/prospects (filtres, tri, pagination, vues enregistrées),
 * GET /api/prospects/:id (score détaillé, preuves par champ), PATCH étape/propriétaire,
 * POST /api/lists, POST /api/prospects/bulk (liste, pipeline, séquence, export).
 */
type Row = [
  person: string,
  role: L,
  org: string,
  city: L,
  cc: string,
  sector: string,
  model: string,
  score: number,
  email: EmailStatus,
  phone: boolean,
  whatsapp: boolean,
  source: string,
  stage: Stage,
  owner: string,
  value: number,
  added: number,
  employees: string,
  kind?: 'company' | 'person',
];

const R = (fr: string, en: string = fr): L => ({ fr, en });

const ROWS: Row[] = [
  ['Claire Fontaine', R('Fondatrice', 'Founder'), 'Cabinet Dentaire Confluence', R('Lyon'), 'FR', 'q_health', 'b2b', 94, 'valid', true, false, 'SIRENE', 'meeting', 'Sofia Rossi', 4800, 2, '6'],
  ['Émilie Gagnon', R('Directrice', 'Director'), 'Clinique Dentaire Rosemont', R('Montréal', 'Montreal'), 'CA', 'q_health', 'b2b', 89, 'valid', true, false, 'Google Places', 'replied', 'Sofia Rossi', 4200, 3, '11'],
  ['Rachel Kim', R('Associée gérante', 'Managing partner'), 'South Congress Dental Studio', R('Austin'), 'US', 'q_health', 'b2b', 86, 'valid', true, false, 'Google Places', 'contacted', 'James Carter', 5200, 3, '8'],
  ['Tiago Ferreira', R('Fondateur', 'Founder'), 'Clínica Dentária Alfama', R('Lisbonne', 'Lisbon'), 'PT', 'q_health', 'b2b', 82, 'valid', true, true, 'OpenCorporates', 'new', 'James Carter', 3900, 1, '5'],
  ['Hannah Weber', R('Directrice des achats', 'Head of procurement'), 'Brennwerk Maschinenbau GmbH', R('Stuttgart'), 'DE', 'c_manufacturing', 'procurement_sourcing', 91, 'valid', true, false, 'OpenCorporates', 'meeting', 'Kenji Watanabe', 38000, 6, '420'],
  ['Marco Bianchi', R('Responsable export', 'Export manager'), 'Agrimacchine Bianchi Srl', R('Bologne', 'Bologna'), 'IT', 'c_manufacturing', 'partners_distributors', 88, 'valid', true, true, 'Site web', 'replied', 'Kenji Watanabe', 26000, 9, '140'],
  ['Priya Raman', R('Directrice des opérations', 'COO'), 'Lumen Ledger Ltd', R('Londres', 'London'), 'GB', 'k_finance', 'b2b', 87, 'valid', true, false, 'Companies House', 'won', 'James Carter', 18000, 21, '45'],
  ['Daniel Osei', R('Directeur général', 'Managing director'), 'Osei & Partners Accountants', R('Manchester'), 'GB', 'm_professional', 'b2b', 84, 'valid', true, false, 'Companies House', 'contacted', 'Amara Okafor', 9600, 4, '28'],
  ['Laura Méndez', R('Fondatrice', 'Founder'), 'Envases Verdes SL', R('Valence', 'Valencia'), 'ES', 'c_manufacturing', 'procurement_sourcing', 83, 'risky', true, true, 'Site web', 'new', 'Amara Okafor', 21000, 1, '60'],
  ['Mei Tanaka', R('Responsable RSE', 'CSR lead'), 'Fondation Aoba', R('Tokyo'), 'JP', 's_other_services', 'b2n', 80, 'valid', false, false, 'Site web', 'contacted', 'Léa Martin', 0, 7, '18'],
  ['Ethan Brooks', R('Directeur du recrutement', 'Head of talent'), 'Kitepay', R('Berlin'), 'DE', 'j_tech_media', 'talent_recruiting', 85, 'valid', false, false, 'Signal : levée de fonds', 'replied', 'Sofia Rossi', 14000, 5, '75'],
  ['Sophie Van Dijk', R('CTO'), 'Tulip Fintech BV', R('Amsterdam'), 'NL', 'j_tech_media', 'talent_recruiting', 79, 'valid', false, false, 'Signal : recrutement', 'new', 'Sofia Rossi', 12000, 2, '52'],
  ['Andrés Castillo', R('Gérant', 'Owner'), 'La Mesa de Lapa', R('Lisbonne', 'Lisbon'), 'PT', 'i_hospitality', 'local_business', 77, 'none', true, true, 'Google Places', 'contacted', 'Amara Okafor', 1800, 8, '14'],
  ['Olivia Grant', R('Gestionnaire de copropriétés', 'Condominium manager'), 'Gestion Mont-Royal', R('Montréal', 'Montreal'), 'CA', 'l_real_estate', 'b2b', 81, 'valid', true, false, 'Registre du Québec', 'meeting', 'James Carter', 7200, 11, '22'],
  ['Carlos Rivera', R('Propriétaire', 'Owner'), 'Rivera Holdings LLC', R('Miami Beach'), 'US', 'l_real_estate', 'real_estate', 76, 'risky', true, false, 'Registre de Floride', 'new', 'Kenji Watanabe', 15000, 1, '4'],
  ['Aisha Bello', R('Directrice des partenariats', 'Partnerships director'), 'Clearwater Initiative', R('Nairobi'), 'KE', 's_other_services', 'b2n', 78, 'valid', true, true, 'Site web', 'contacted', 'Léa Martin', 0, 12, '35'],
  ['Thomas Girard', R('Praticien associé', 'Partner dentist'), 'Centre Dentaire Part-Dieu', R('Lyon'), 'FR', 'q_health', 'b2b', 74, 'valid', true, false, 'SIRENE', 'lost', 'Sofia Rossi', 4100, 30, '9'],
  ['Isabel Costa', R('Directrice commerciale', 'Sales director'), 'Sabores do Brasil Ltda', R('São Paulo'), 'BR', 'g_trade', 'partners_distributors', 73, 'valid', true, true, 'Site web', 'new', 'Amara Okafor', 11000, 2, '90'],
  ['Arjun Mehta', R('Fondateur', 'Founder'), 'Kirana Cloud', R('Bangalore', 'Bengaluru'), 'IN', 'j_tech_media', 'b2b', 72, 'valid', false, false, 'Signal : levée de fonds', 'contacted', 'Kenji Watanabe', 8000, 6, '30'],
  ['Chloé Dubois', R('Coach sportive indépendante', 'Independent fitness coach'), 'Chloé Dubois Coaching', R('Bordeaux'), 'FR', 'r_arts_recreation', 'c2b', 71, 'valid', false, true, 'Page professionnelle publique', 'new', 'Amara Okafor', 600, 3, '1', 'person'],
  ['Jake Morrison', R('Photographe de mariage', 'Wedding photographer'), 'Morrison Studio', R('Austin'), 'US', 'r_arts_recreation', 'b2c', 69, 'valid', true, false, 'Page professionnelle publique', 'contacted', 'Sofia Rossi', 900, 5, '1', 'person'],
  ['Natalia Nowak', R('Directrice générale', 'CEO'), 'AgroTech Polska Sp. z o.o.', R('Poznań'), 'PL', 'a_agriculture', 'partners_distributors', 75, 'valid', true, false, 'OpenCorporates', 'replied', 'Kenji Watanabe', 19000, 10, '65'],
  ['Liam O’Connor', R('Responsable des marchés publics', 'Procurement officer'), 'Dublin City Council', R('Dublin'), 'IE', 'o_public_admin', 'b2g', 70, 'valid', true, false, 'TED', 'new', 'James Carter', 42000, 4, '6000'],
  ['Fatima Zahra El Idrissi', R('Fondatrice', 'Founder'), 'Atlas Cosmétiques', R('Casablanca'), 'MA', 'c_manufacturing', 'd2c', 68, 'risky', true, true, 'Site web', 'contacted', 'Amara Okafor', 6500, 9, '25'],
  ['Grace Lee', R('Directrice des achats', 'Purchasing manager'), 'Harbourline Foods Pte Ltd', R('Singapour', 'Singapore'), 'SG', 'g_trade', 'procurement_sourcing', 67, 'valid', true, false, 'ACRA', 'new', 'Kenji Watanabe', 23000, 2, '210'],
  ['Noah Fischer', R('Gérant', 'Owner'), 'Fischer Dachbau', R('Zurich'), 'CH', 'f_construction', 'local_business', 66, 'none', true, false, 'Google Places', 'lost', 'Amara Okafor', 3000, 26, '12'],
  ['Sarah Peeters', R('Fondatrice', 'Founder'), 'Cabinet Sourire Ixelles', R('Bruxelles', 'Brussels'), 'BE', 'q_health', 'b2b', 77, 'none', true, false, 'BCE', 'contacted', 'Sofia Rossi', 3800, 6, '4'],
  ['Kwame Mensah', R('Directeur logistique', 'Logistics director'), 'Gold Coast Freight', R('Accra'), 'GH', 'h_transport', 'b2b', 64, 'valid', true, true, 'Site web', 'new', 'Kenji Watanabe', 9000, 3, '120'],
  ['Emma Thompson', R('Directrice', 'Principal'), 'Riverside Language School', R('Sydney'), 'AU', 'p_education', 'education_institutions', 72, 'valid', true, false, 'ABN Lookup', 'replied', 'James Carter', 5400, 7, '40'],
  ['Yuki Sato', R('Responsable presse', 'Press officer'), 'Tokyo Design Week', R('Tokyo'), 'JP', 'r_arts_recreation', 'events_exhibitors', 65, 'valid', false, false, 'Site web', 'new', 'Léa Martin', 2500, 1, '15'],
  ['Mateo González', R('Fondateur', 'Founder'), 'Taller Textil Circular', R('Mexico', 'Mexico City'), 'MX', 'e_water_waste', 'g2b', 63, 'risky', true, true, 'Site web', 'contacted', 'Amara Okafor', 4000, 13, '19'],
  ['Elena Popescu', R('Directrice générale', 'General manager'), 'Agromec Distribuție SRL', R('Cluj-Napoca'), 'RO', 'g_trade', 'partners_distributors', 74, 'valid', true, false, 'OpenCorporates', 'meeting', 'Kenji Watanabe', 17000, 15, '48'],
];

const STAGE_NEXT: Record<Stage, L | null> = {
  new: R('Premier message à envoyer', 'First message to send'),
  contacted: R('Relance 1', 'Follow-up 1'),
  replied: R('Proposer un rendez-vous', 'Suggest a meeting'),
  meeting: R('Préparer la démonstration', 'Prepare the demo'),
  won: null,
  lost: null,
};
const STAGE_LAST: Record<Stage, L> = {
  new: R('Ajouté par l’agent Recherche', 'Added by the Search agent'),
  contacted: R('Email envoyé', 'Email sent'),
  replied: R('A répondu par email', 'Replied by email'),
  meeting: R('Rendez-vous confirmé', 'Meeting confirmed'),
  won: R('Marqué comme validé', 'Marked as won'),
  lost: R('Marqué comme perdu : budget', 'Marked as lost: budget'),
};

function slug(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function reasons(score: number, sector: string, role: L): { pts: number; label: L }[] {
  const base = [
    { pts: 30, label: R('Secteur dans la cible', 'Industry within target') },
    { pts: 22, label: R(`Décideur identifié : ${role.fr.toLowerCase()}`, `Decision-maker identified: ${role.en.toLowerCase()}`) },
    { pts: 16, label: R('Taille dans la cible', 'Size within target') },
    { pts: 14, label: sector === 'j_tech_media' ? R('Signal récent : levée de fonds', 'Recent signal: funding round') : R('Signal récent sur le site', 'Recent signal on the website') },
    { pts: 12, label: R('Canal de contact vérifié', 'Contact channel verified') },
    { pts: 6, label: R('Zone géographique prioritaire', 'Priority area') },
  ];
  // Ajuste le total au score affiché (les raisons somment toujours au score).
  let rest = score;
  return base
    .map((r) => {
      const pts = Math.min(r.pts, rest);
      rest -= pts;
      return { ...r, pts };
    })
    .filter((r) => r.pts > 0);
}

const DIAL: Record<string, string> = { FR: '33', CA: '1', US: '1', PT: '351', DE: '49', IT: '39', GB: '44', ES: '34', JP: '81', NL: '31', KE: '254', BR: '55', IN: '91', PL: '48', IE: '353', MA: '212', SG: '65', CH: '41', BE: '32', GH: '233', AU: '61', MX: '52', RO: '40' };

function fakePhone(cc: string, i: number) {
  const n = String(100000000 + ((i * 48271) % 899999999)).slice(0, 9);
  return `+${DIAL[cc] ?? '00'} ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}

const LISTS: Record<string, string> = {
  q_health: 'Cabinets dentaires 2026',
  c_manufacturing: 'Industrie Europe',
  j_tech_media: 'Fintech qui recrutent',
  l_real_estate: 'Immobilier Amérique du Nord',
};

export const DEMO_PROSPECTS: DemoProspect[] = ROWS.map((r, i) => {
  const [person, role, org, city, cc, sector, model, score, emailStatus, phone, whatsapp, source, stage, owner, value, added, employees, kind] = r;
  const domain = `${slug(org).split('-').slice(0, 2).join('-')}.example`;
  const first = slug(person.split(' ')[0] ?? person);
  return {
    id: `p${String(i + 1).padStart(3, '0')}`,
    kind: kind ?? 'company',
    person,
    role,
    org,
    city,
    cc,
    sector,
    model,
    score,
    reasons: reasons(score, sector, role),
    email: emailStatus === 'none' ? '' : `${first}@${domain}`,
    emailStatus,
    phone: phone ? fakePhone(cc, i + 1) : null,
    whatsapp,
    source,
    stage,
    owner,
    valueUsd: value,
    addedDaysAgo: added,
    lastActivity: STAGE_LAST[stage],
    nextStep: STAGE_NEXT[stage],
    dueInDays: stage === 'won' || stage === 'lost' ? null : ((i * 3) % 5) - 1,
    employees,
    website: `https://www.${domain}`,
    lists: LISTS[sector] ? [LISTS[sector]] : [],
    legalBasis: kind === 'person' ? 'public_professional' : 'legitimate_interest',
    collectedAt: `2026-11-${String(22 - Math.min(added, 21)).padStart(2, '0')}`,
  };
});

export function getDemoProspects() {
  return DEMO_PROSPECTS;
}
export function getDemoProspect(id: string) {
  return DEMO_PROSPECTS.find((p) => p.id === id) ?? null;
}
export const DEMO_LISTS = Object.values(LISTS);

/** Premier message proposé par l'agent Rédaction (gabarit de démonstration). */
export function demoMessage(p: DemoProspect, locale: 'fr' | 'en') {
  const first = p.person.split(' ')[0];
  if (locale === 'fr')
    return {
      subject: `Une idée pour ${p.org}`,
      body: `Bonjour ${first},\n\nJ’ai vu que ${p.org} à ${p.city.fr} ${p.reasons[3]?.label.fr.toLowerCase() ?? 'se développe'}. Nous aidons des structures comme la vôtre à trouver plus vite leurs prochains clients, avec des contacts vérifiés et un premier message prêt.\n\nAuriez-vous 15 minutes la semaine prochaine pour en parler ?\n\nLéa Martin, Northwind`,
    };
  return {
    subject: `An idea for ${p.org}`,
    body: `Hi ${first},\n\nI noticed that ${p.org} in ${p.city.en} shows a ${p.reasons[3]?.label.en.toLowerCase() ?? 'growth signal'}. We help organisations like yours find their next customers faster, with verified contacts and a first message ready.\n\nWould you have 15 minutes next week to talk about it?\n\nLéa Martin, Northwind`,
  };
}
