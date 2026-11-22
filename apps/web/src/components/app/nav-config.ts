import {
  Home, Search, Inbox, ListChecks, Bookmark, BookOpen, Radio, Megaphone, Database, UserCheck, Contact,
  KanbanSquare, Workflow, Zap, BarChart3, Users, Download, Plug, ShieldCheck, Settings, FileText, LifeBuoy,
  type LucideIcon,
} from 'lucide-react';
import type { Action } from '@scoutra/auth';
import type { MessageKey } from '@scoutra/i18n';

export interface NavItem {
  id: string;
  href: string;
  label: MessageKey;
  icon: LucideIcon;
  /** Permission(s) : l'élément est visible si l'une d'elles est accordée (ou demande la 2FA). */
  perm?: Action[];
  /** Raccourci « G puis lettre ». */
  key?: string;
  /** Compteur affiché (démonstration). */
  count?: number;
}
export interface NavSection {
  id: string;
  label: MessageKey;
  items: NavItem[];
}

export const PRIMARY: NavItem[] = [
  { id: 'home', href: '/home', label: 'app.nav.home', icon: Home, key: 'h' },
  { id: 'search', href: '/search', label: 'app.nav.search', icon: Search, perm: ['campaign:read'], key: 's' },
  { id: 'inbox', href: '/inbox', label: 'app.nav.inbox', icon: Inbox, perm: ['message:read'], key: 'm', count: 2 },
  { id: 'tasks', href: '/tasks', label: 'app.nav.tasks', icon: ListChecks, perm: ['task:read'], key: 't', count: 4 },
];

export const SECTIONS: NavSection[] = [
  {
    id: 'prospecting',
    label: 'app.nav.prospecting',
    items: [
      { id: 'saved', href: '/search/saved', label: 'app.nav.saved', icon: Bookmark, perm: ['campaign:read'] },
      { id: 'playbooks', href: '/playbooks', label: 'app.nav.playbooks', icon: BookOpen, perm: ['campaign:read'], key: 'y' },
      { id: 'signals', href: '/signals', label: 'app.nav.signals', icon: Radio, perm: ['signal:read'], key: 'i', count: 3 },
      { id: 'campaigns', href: '/campaigns', label: 'app.nav.campaigns', icon: Megaphone, perm: ['campaign:read'], key: 'c' },
    ],
  },
  {
    id: 'base',
    label: 'app.nav.base',
    items: [
      { id: 'prospects', href: '/prospects', label: 'app.nav.prospects', icon: Database, perm: ['prospect:read'], key: 'b' },
      { id: 'leads', href: '/leads', label: 'app.nav.leads', icon: UserCheck, perm: ['prospect:read'], key: 'l' },
      { id: 'contacts', href: '/contacts', label: 'app.nav.contacts', icon: Contact, perm: ['contact:read'] },
    ],
  },
  {
    id: 'followup',
    label: 'app.nav.followup',
    items: [
      { id: 'pipeline', href: '/pipeline', label: 'app.nav.pipeline', icon: KanbanSquare, perm: ['pipeline:read'], key: 'p' },
      { id: 'sequences', href: '/sequences', label: 'app.nav.sequences', icon: Workflow, perm: ['sequence:read'], key: 'q' },
      { id: 'automations', href: '/automations', label: 'app.nav.automations', icon: Zap, perm: ['automation:read'] },
    ],
  },
  {
    id: 'steering',
    label: 'app.nav.steering',
    items: [
      { id: 'analytics', href: '/analytics', label: 'app.nav.analytics', icon: BarChart3, perm: ['report:read_own'], key: 'a' },
      { id: 'team', href: '/team', label: 'app.nav.team', icon: Users, perm: ['member:list'], key: 'e' },
      { id: 'exports', href: '/exports', label: 'app.nav.exports', icon: Download, perm: ['prospect:export'] },
    ],
  },
  {
    id: 'admin',
    label: 'app.nav.admin',
    items: [
      { id: 'integrations', href: '/integrations', label: 'app.nav.integrations', icon: Plug, perm: ['integration:manage', 'apikey:manage'] },
      { id: 'compliance', href: '/compliance', label: 'app.nav.compliance', icon: ShieldCheck, perm: ['compliance:read'] },
      { id: 'settings', href: '/settings', label: 'app.nav.settings', icon: Settings, key: ',' },
    ],
  },
];

export const HELP: NavItem[] = [
  { id: 'docs', href: '/docs', label: 'app.nav.docs', icon: FileText },
  { id: 'help', href: '/help', label: 'app.nav.helpCenter', icon: LifeBuoy },
];

export const ALL_ITEMS: NavItem[] = [...PRIMARY, ...SECTIONS.flatMap((s) => s.items), ...HELP];
