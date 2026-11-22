import ipaddr from 'ipaddr.js';

const GLOBAL_UNICAST_V6 = ipaddr.parseCIDR('2000::/3');
// Plages IPv6 « globales » en apparence mais qui encapsulent de l'IPv4 ou sont réservées.
const BLOCKED_V6 = [
  '2001:db8::/32', // documentation
  '2002::/16', // 6to4 (peut encapsuler une IPv4 privée)
  '2001::/32', // Teredo
  '2001:2::/48', // tests de performance
  '2001:10::/28', // ORCHID
  '2001:20::/28', // ORCHIDv2
].map((c) => ipaddr.parseCIDR(c));

/**
 * Vrai uniquement pour une adresse IP publique routable (unicast global).
 * Toute adresse non analysable est refusée (refus par défaut).
 */
export function isPublicIp(address: string): boolean {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    // Strict : n'accepte que les écritures canoniques (pas d'octal ni d'hexadécimal).
    if (!ipaddr.isValid(address)) return false;
    parsed = ipaddr.parse(address);
  } catch {
    return false;
  }

  if (parsed.kind() === 'ipv4') {
    const v4 = parsed as ipaddr.IPv4;
    if (!ipaddr.IPv4.isValidFourPartDecimal(address)) return false;
    return v4.range() === 'unicast';
  }

  const v6 = parsed as ipaddr.IPv6;
  if (v6.zoneId) return false; // fe80::1%eth0 etc.
  // ::ffff:a.b.c.d et ::a.b.c.d : refusés sans exception (pas d'IPv4 par la bande).
  if (v6.isIPv4MappedAddress()) return false;
  if (!v6.match(GLOBAL_UNICAST_V6)) return false;
  if (BLOCKED_V6.some((cidr) => v6.match(cidr))) return false;
  return v6.range() === 'unicast';
}

export function isIpLiteral(host: string): boolean {
  return ipaddr.isValid(host);
}
