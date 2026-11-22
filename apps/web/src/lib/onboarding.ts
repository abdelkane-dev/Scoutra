'use client';
import { apiFetch } from './api';

export interface OrgProfileInput {
  accountType: string;
  sectors: string[];
}

/** Enregistre le type de compte et les secteurs (PUT /api/organization/profile, owner/admin). */
export function saveOrganizationProfile(input: OrgProfileInput) {
  return apiFetch<OrgProfileInput>('/api/organization/profile', { method: 'PUT', body: input });
}

/** Identifiant d'URL dérivé du nom (l'unicité est vérifiée par le serveur). */
export function slugify(name: string) {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || 'org'}-${suffix}`;
}
