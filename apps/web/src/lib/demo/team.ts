import type { DemoMember } from './types';

/** Besoin d'API : objectifs et statistiques par membre (GET /api/team/stats). */
export const DEMO_MEMBERS: DemoMember[] = [
  { id: 'm1', name: 'Léa Martin', email: 'lea@northwind.example', role: 'owner', twoFactor: true, lastActive: { fr: 'En ligne', en: 'Online' }, prospectsMonth: 214, meetingsMonth: 9, goalMeetings: 10, wonMonth: 4, goalWon: 4 },
  { id: 'm2', name: 'James Carter', email: 'james@northwind.example', role: 'manager', twoFactor: true, lastActive: { fr: 'il y a 12 min', en: '12 min ago' }, prospectsMonth: 388, meetingsMonth: 14, goalMeetings: 12, wonMonth: 5, goalWon: 6 },
  { id: 'm3', name: 'Sofia Rossi', email: 'sofia@northwind.example', role: 'member', twoFactor: false, lastActive: { fr: 'il y a 1 h', en: '1 h ago' }, prospectsMonth: 296, meetingsMonth: 11, goalMeetings: 10, wonMonth: 3, goalWon: 4 },
  { id: 'm4', name: 'Kenji Watanabe', email: 'kenji@northwind.example', role: 'member', twoFactor: true, lastActive: { fr: 'hier', en: 'yesterday' }, prospectsMonth: 251, meetingsMonth: 6, goalMeetings: 10, wonMonth: 2, goalWon: 4 },
  { id: 'm5', name: 'Amara Okafor', email: 'amara@northwind.example', role: 'member', twoFactor: false, lastActive: { fr: 'il y a 3 h', en: '3 h ago' }, prospectsMonth: 173, meetingsMonth: 8, goalMeetings: 8, wonMonth: 3, goalWon: 3 },
  { id: 'm6', name: 'Lucas Moreau', email: 'lucas@northwind.example', role: 'viewer', twoFactor: false, lastActive: { fr: 'il y a 2 j', en: '2 d ago' }, prospectsMonth: 0, meetingsMonth: 0, goalMeetings: 0, wonMonth: 0, goalWon: 0 },
  { id: 'm7', name: 'Nina Schmidt', email: 'nina@northwind.example', role: 'billing', twoFactor: true, lastActive: { fr: 'il y a 5 j', en: '5 d ago' }, prospectsMonth: 0, meetingsMonth: 0, goalMeetings: 0, wonMonth: 0, goalWon: 0 },
];

export function getDemoMembers() {
  return DEMO_MEMBERS;
}
