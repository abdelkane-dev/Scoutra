import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ACTIONS, assignableRoles, can, hashPassword, verifyPassword } from '../src';

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
          ['owner', 'admin', 'member'].includes(role as string) &&
          Object.hasOwn(ACTIONS, action as string);
        if (!known) expect(can(role, action)).toBe(false);
      }),
    );
    expect(can('owner', '__proto__')).toBe(false);
    expect(can('owner', 'constructor')).toBe(false);
    expect(can('superadmin', 'org:read')).toBe(false);
  });

  it('le propriétaire peut tout ; la hiérarchie est monotone', () => {
    for (const a of Object.keys(ACTIONS)) {
      expect(can('owner', a)).toBe(true);
      if (can('member', a)) expect(can('admin', a)).toBe(true);
    }
  });

  it('attribution de rôles bornée', () => {
    expect(assignableRoles('admin')).toEqual(['member']);
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
