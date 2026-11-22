/**
 * DONNÉES DE DÉMONSTRATION — personnes, organisations et chiffres FICTIFS.
 * Chaque fonction `get…()` de ce dossier remplace une API pas encore disponible ; la brancher
 * sur la vraie route le moment venu (voir la liste des besoins en tête de chaque fichier).
 * L'interface affiche le bandeau « Données de démonstration » partout où elles sont utilisées.
 */
export const DEMO = true as const;

export type L = { fr: string; en: string };
export type Stage = 'new' | 'contacted' | 'replied' | 'meeting' | 'won' | 'lost';
export type EmailStatus = 'valid' | 'risky' | 'invalid' | 'none';
export type Channel = 'email' | 'phone' | 'whatsapp' | 'linkedin_manual';

export interface DemoProspect {
  id: string;
  kind: 'company' | 'person';
  person: string;
  role: L;
  org: string;
  city: L;
  cc: string;
  sector: string;
  model: string;
  score: number;
  reasons: { pts: number; label: L }[];
  email: string;
  emailStatus: EmailStatus;
  phone: string | null;
  whatsapp: boolean;
  source: string;
  stage: Stage;
  owner: string;
  valueUsd: number;
  addedDaysAgo: number;
  lastActivity: L;
  nextStep: L | null;
  dueInDays: number | null;
  employees: string;
  website: string;
  lists: string[];
  legalBasis: 'legitimate_interest' | 'public_professional' | 'consent';
  collectedAt: string;
}

export interface DemoMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer' | 'billing';
  twoFactor: boolean;
  lastActive: L;
  prospectsMonth: number;
  meetingsMonth: number;
  goalMeetings: number;
  wonMonth: number;
  goalWon: number;
}
