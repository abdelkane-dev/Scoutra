import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ORG_ROLES } from '@scoutra/core';
import {
  ACTIONS,
  ACTION_NAMES,
  assignableRoles,
  can,
  dataScope,
  effectivePermissions,
  hashPassword,
  isPlatformOperator,
  isReadAction,
  verifyPassword,
} from '../src';

describe('contrôle d’accès', () => {
  it('matrice', () => {
    expect(can('member', 'campaign:write')).toBe(true);
    expect(can('member', 'apikey:manage')).toBe(false);
    expect(can('admin', 'apikey:manage')).toBe(true);
    expect(can('admin', 'billing:manage')).toBe(false);
    expect(can('owner', 'billing:manage')).toBe(true);
  });

  it('refus par défaut pour tout rôle ou action inconnus (propriété)', () => {
    fc.assert(
      fc.property(fc.anything(), fc.anything(), (role, action) => {
        const known =
          (ORG_ROLES as readonly unknown[]).includes(role) &&
          Object.hasOwn(ACTIONS, action as string);
        if (!known) expect(can(role, action)).toBe(false);
      }),
    );
    expect(can('owner', '__proto__')).toBe(false);
    expect(can('owner', 'constructor')).toBe(false);
    expect(can('superadmin', 'org:read')).toBe(false);
  });

  it('le propriétaire peut tout ; admin ⊇ manager ⊇ member (hors facturation)', () => {
    for (const a of ACTION_NAMES) {
      expect(can('owner', a)).toBe(true);
      if (can('member', a)) expect(can('manager', a)).toBe(true);
      if (can('manager', a)) expect(can('admin', a)).toBe(true);
    }
  });

  it('viewer : lecture seule ; billing : facturation et crédits uniquement', () => {
    for (const a of ACTION_NAMES) {
      if (can('viewer', a)) expect(isReadAction(a)).toBe(true);
      if (can('billing', a))
        expect([
          'org:read',
          'member:list',
          'credits:read',
          'billing:read',
          'billing:manage',
        ]).toContain(a);
    }
    expect(can('viewer', 'prospect:read_all')).toBe(true);
    expect(can('viewer', 'prospect:export')).toBe(false);
    expect(can('billing', 'billing:manage')).toBe(true);
    expect(can('billing', 'prospect:read')).toBe(false);
    expect(can('admin', 'billing:manage')).toBe(false);
  });

  it('manager : pipeline, séquences, assignations, rapports d’équipe ; member : les siens', () => {
    for (const a of ['pipeline:manage', 'sequence:manage', 'prospect:assign', 'report:read_team'])
      expect(can('manager', a)).toBe(true);
    for (const a of ['pipeline:manage', 'sequence:manage', 'prospect:assign', 'report:read_team'])
      expect(can('member', a)).toBe(false);
    expect(can('member', 'campaign:write')).toBe(true);
    expect(can('member', 'pipeline:write')).toBe(true);
    expect(can('manager', 'member:invite')).toBe(false);
    expect(dataScope('member')).toBe('own');
    expect(dataScope('manager')).toBe('team');
    expect(dataScope('viewer')).toBe('team');
    expect(dataScope('billing')).toBe('none');
    expect(dataScope('inconnu')).toBe('none');
  });

  it('permissions effectives : 2FA et licence prises en compte', () => {
    const p = effectivePermissions({
      role: 'admin',
      twoFactorEnabled: false,
      enforceTwoFactor: true,
      licenseStatus: 'valid',
    });
    expect(p.allowed).toContain('campaign:write');
    expect(p.allowed).not.toContain('apikey:manage');
    expect(p.needsTwoFactor).toContain('apikey:manage');
    const ro = effectivePermissions({
      role: 'owner',
      twoFactorEnabled: true,
      enforceTwoFactor: true,
      licenseStatus: 'read_only',
    });
    expect(ro.allowed.every((a) => isReadAction(a))).toBe(true);
    expect(Object.keys(ACTIONS).length).toBe(ACTION_NAMES.length);
  });

  it('opérateur plateforme : SaaS uniquement, jamais en licence', () => {
    expect(isPlatformOperator('operator', 'saas')).toBe(true);
    expect(isPlatformOperator('operator', 'license')).toBe(false);
    expect(isPlatformOperator(null, 'saas')).toBe(false);
    expect(isPlatformOperator('admin', 'saas')).toBe(false);
  });

  it('attribution de rôles bornée', () => {
    expect(assignableRoles('admin')).toEqual(['manager', 'member', 'viewer', 'billing']);
    expect(assignableRoles('manager')).toEqual([]);
    expect(assignableRoles('owner')).toEqual([...ORG_ROLES]);
    expect(assignableRoles('member')).toEqual([]);
    expect(assignableRoles(undefined)).toEqual([]);
  });
});

describe('mots de passe', () => {
  it('argon2id, vérification, rejet d’un autre hachage', async () => {
    const h = await hashPassword('un mot de passe solide 2026');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword({ hash: h, password: 'un mot de passe solide 2026' })).toBe(true);
    expect(await verifyPassword({ hash: h, password: 'autre' })).toBe(false);
    expect(await verifyPassword({ hash: 'scrypt:abc', password: 'x' })).toBe(false);
  });
});

describe('decideAccess (revue étape 1, constat 4)', async () => {
  const { decideAccess, requiresTwoFactor, canManageMember } = await import('../src');
  const base = { twoFactorEnabled: false, enforceTwoFactor: true, licenseStatus: 'valid' as const };

  it('owner/admin sans 2FA : actions sensibles refusées avec two_factor_required', () => {
    expect(decideAccess({ ...base, role: 'admin', action: 'apikey:manage' })).toEqual({
      ok: false,
      reason: 'two_factor_required',
    });
    expect(decideAccess({ ...base, role: 'owner', action: 'member:invite' })).toEqual({
      ok: false,
      reason: 'two_factor_required',
    });
    expect(decideAccess({ ...base, role: 'owner', action: 'campaign:write' })).toEqual({
      ok: true,
    });
    expect(
      decideAccess({ ...base, role: 'admin', action: 'apikey:manage', twoFactorEnabled: true }),
    ).toEqual({ ok: true });
    expect(
      decideAccess({ ...base, role: 'admin', action: 'apikey:manage', enforceTwoFactor: false }),
    ).toEqual({ ok: true });
  });

  it('le rôle est vérifié avant la 2FA ; un membre sans droit reçoit forbidden', () => {
    expect(decideAccess({ ...base, role: 'member', action: 'apikey:manage' })).toEqual({
      ok: false,
      reason: 'forbidden',
    });
    expect(requiresTwoFactor('member', 'prospect:read')).toBe(false);
  });

  it('licence : lecture seule bloque les écritures, pas les lectures ; invalide bloque tout', () => {
    expect(
      decideAccess({
        ...base,
        role: 'member',
        action: 'campaign:write',
        licenseStatus: 'read_only',
      }).ok,
    ).toBe(false);
    expect(
      decideAccess({ ...base, role: 'member', action: 'campaign:read', licenseStatus: 'read_only' })
        .ok,
    ).toBe(true);
    expect(
      decideAccess({ ...base, role: 'member', action: 'campaign:read', licenseStatus: 'invalid' })
        .ok,
    ).toBe(false);
  });

  it('gestion des membres : uniquement les rangs inférieurs', () => {
    expect(canManageMember('admin', 'member')).toBe(true);
    expect(canManageMember('admin', 'admin')).toBe(false);
    expect(canManageMember('admin', 'owner')).toBe(false);
    expect(canManageMember('owner', 'admin')).toBe(true);
    expect(canManageMember('member', 'member')).toBe(false);
    expect(canManageMember('admin', 'manager')).toBe(true);
    expect(canManageMember('admin', 'billing')).toBe(true);
    expect(canManageMember('manager', 'member')).toBe(false);
    expect(canManageMember('billing', 'viewer')).toBe(false);
  });
});
