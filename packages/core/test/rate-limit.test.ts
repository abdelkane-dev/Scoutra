import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { SlidingWindowLimiter } from '../src';

describe('SlidingWindowLimiter', () => {
  it('bloque au-delà de max dans la fenêtre, puis libère', () => {
    const l = new SlidingWindowLimiter(3, 1000);
    expect([0, 1, 2, 3].map((i) => l.take('org-a', 100 + i))).toEqual([true, true, true, false]);
    expect(l.take('org-b', 105)).toBe(true); // clés indépendantes
    expect(l.take('org-a', 1101)).toBe(true);
  });

  it('propriété : jamais plus de max appels acceptés sur une fenêtre', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 5000 }), { maxLength: 200 }), (times) => {
        const l = new SlidingWindowLimiter(5, 1000);
        const accepted = [...times].sort((a, b) => a - b).filter((t) => l.take('k', t));
        for (const t of accepted)
          expect(accepted.filter((x) => x > t - 1000 && x <= t).length).toBeLessThanOrEqual(5);
      }),
    );
  });

  it('borne la mémoire', () => {
    const l = new SlidingWindowLimiter(1, 1000, 10);
    for (let i = 0; i < 100; i++) l.take(`k${i}`, i);
    expect(l.take('k0', 200)).toBe(true); // expulsée, donc libre
  });
});

describe('ConcurrencySlots (revue étape 2, constat 3)', async () => {
  const { ConcurrencySlots } = await import('../src');
  it('plafond par utilisateur et par organisation ; libération idempotente', () => {
    const s = new ConcurrencySlots();
    const lim = (u: string) => ({ [`u:${u}`]: 2, 'o:A': 3 });
    const r1 = s.acquire(lim('1'))!;
    s.acquire(lim('1'));
    expect(s.acquire(lim('1'))).toBeNull();
    s.acquire(lim('2'));
    expect(s.acquire(lim('3'))).toBeNull(); // organisation pleine
    r1();
    r1();
    expect(s.count('o:A')).toBe(2);
    expect(s.acquire(lim('3'))).not.toBeNull();
  });
});
