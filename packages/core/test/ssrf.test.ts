import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { assertSafeUrl, isPublicIp, safeFetch } from '../src';

describe('isPublicIp', () => {
  it.each([
    '127.0.0.1',
    '127.255.255.254',
    '10.0.0.1',
    '172.16.5.4',
    '192.168.1.1',
    '169.254.169.254',
    '100.100.100.200',
    '0.0.0.0',
    '255.255.255.255',
    '224.0.0.1',
    '192.0.2.10',
    '198.18.0.1',
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd00:ec2::254',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:169.254.169.254',
    '::127.0.0.1',
    '64:ff9b::a00:1',
    '2002:7f00:1::',
    '2001:db8::1',
    '2001::1',
    'ff02::1',
    '0177.0.0.1',
    '0x7f.0.0.1',
    '2130706433',
    '127.1',
    'not-an-ip',
    '',
  ])('refuse %s', (ip) => {
    expect(isPublicIp(ip)).toBe(false);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '93.184.216.34',
    '2606:4700:4700::1111',
    '2a00:1450:4007:80e::200e',
  ])('accepte %s', (ip) => {
    expect(isPublicIp(ip)).toBe(true);
  });

  it('propriété : toute IPv4 en 10/8, 127/8, 192.168/16 est refusée', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        (a, b, c) => {
          expect(isPublicIp(`10.${a}.${b}.${c}`)).toBe(false);
          expect(isPublicIp(`127.${a}.${b}.${c}`)).toBe(false);
          expect(isPublicIp(`192.168.${b}.${c}`)).toBe(false);
          expect(isPublicIp(`::ffff:10.${a}.${b}.${c}`)).toBe(false);
        },
      ),
    );
  });
});

describe('assertSafeUrl', () => {
  it.each([
    'http://127.0.0.1/',
    'http://localhost/',
    'http://LOCALHOST./',
    'http://api.localhost/',
    'http://169.254.169.254/latest/meta-data/',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[0:0:0:0:0:ffff:a9fe:a9fe]/',
    'http://[fd00:ec2::254]/',
    'http://2130706433/', // 127.0.0.1 en décimal
    'http://0x7f000001/', // hexadécimal
    'http://0177.0.0.1/', // octal
    'http://127.1/',
    'http://0/',
    'http://postgres/', // service Docker
    'http://reacher:8080/',
    'http://printer.local/',
    'https://example.com:8443/',
    'http://example.com:5432/',
    'ftp://example.com/',
    'file:///etc/passwd',
    'gopher://example.com/',
    'http://user:pass@example.com/',
    'javascript:alert(1)',
    'pas une url',
  ])('refuse %s', (u) => {
    expect(() => assertSafeUrl(u)).toThrow(/refusée|invalide/);
  });

  it.each([
    'https://example.com/',
    'http://example.com:80/a?b=c',
    'https://8.8.8.8/',
    'https://[2606:4700:4700::1111]/',
  ])('accepte %s', (u) => {
    expect(assertSafeUrl(u).toString()).toBeTruthy();
  });
});

describe('safeFetch', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const redirects: Record<string, string> = {
        '/to-private': 'http://10.0.0.1/',
        '/to-metadata': 'http://169.254.169.254/latest/meta-data/',
        '/to-ipv6-loopback': 'http://[::1]/',
        '/to-file': 'file:///etc/passwd',
        '/to-encoded': 'http://2130706433/',
        '/to-ok': '/ok',
        '/loop': '/loop',
      };
      const target = redirects[req.url ?? ''];
      if (target) {
        res.writeHead(302, {
          location: target.startsWith('/') ? `http://public.test:${port}${target}` : target,
        });
        res.end();
        return;
      }
      if (req.url === '/to-other-origin') {
        res.writeHead(302, { location: `http://other.test:${port}/echo-headers` });
        res.end();
        return;
      }
      if (req.url === '/echo-body' && req.method === 'POST') {
        let b = '';
        req.on('data', (c: Buffer) => (b += c.toString()));
        req.on('end', () => res.end(`POST:${b}`));
        return;
      }
      if (req.url === '/echo-headers') {
        res.end(JSON.stringify(req.headers));
        return;
      }
      if (req.url === '/slow') {
        setTimeout(() => res.end('tard'), 400);
        return;
      }
      if (req.url === '/big') {
        res.end(Buffer.alloc(2048));
        return;
      }
      res.end('ok');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  // Le serveur de test écoute sur 127.0.0.1 : on simule un hôte « public » en autorisant
  // UNIQUEMENT cette adresse, pour vérifier que tout le reste est bloqué.
  const testOpts = () => ({
    allowedPorts: [80, 443, port],
    resolver: async (host: string) =>
      host === 'public.test' || host === 'other.test'
        ? [{ address: '127.0.0.1', family: 4 }]
        : [{ address: '10.1.2.3', family: 4 }],
    addressPolicy: (ip: string) => ip === '127.0.0.1',
  });

  it('suit une redirection autorisée', async () => {
    const res = await safeFetch(`http://public.test:${port}/to-ok`, testOpts());
    expect(res.status).toBe(200);
    expect(res.body.toString()).toBe('ok');
  });

  it.each(['/to-private', '/to-metadata', '/to-ipv6-loopback', '/to-file', '/to-encoded'])(
    'bloque la redirection %s',
    async (path) => {
      await expect(safeFetch(`http://public.test:${port}${path}`, testOpts())).rejects.toThrow(
        /refusée/,
      );
    },
  );

  it('POST : corps envoyé ; redirection refusée', async () => {
    const res = await safeFetch(`http://public.test:${port}/echo-body`, {
      ...testOpts(),
      method: 'POST',
      body: '{"q":1}',
    });
    expect(res.body.toString()).toBe('POST:{"q":1}');
    await expect(
      safeFetch(`http://public.test:${port}/to-ok`, { ...testOpts(), method: 'POST', body: '{}' }),
    ).rejects.toThrow(/Redirection refusée/);
  });

  it('limite le nombre de redirections', async () => {
    await expect(
      safeFetch(`http://public.test:${port}/loop`, { ...testOpts(), maxRedirects: 3 }),
    ).rejects.toThrow(/Trop de redirections/);
  });

  it('bloque un nom qui résout vers une IP interne (DNS rebinding)', async () => {
    await expect(safeFetch(`http://evil.test:${port}/`, testOpts())).rejects.toThrow(
      /adresse interne/,
    );
  });

  it('bloque si une seule des adresses résolues est interne', async () => {
    await expect(
      safeFetch(`http://public.test:${port}/`, {
        ...testOpts(),
        resolver: async () => [
          { address: '127.0.0.1', family: 4 },
          { address: '192.168.0.1', family: 4 },
        ],
      }),
    ).rejects.toThrow(/adresse interne/);
  });

  it('avec la politique par défaut, refuse la connexion à 127.0.0.1 même via un nom public', async () => {
    await expect(
      safeFetch(`http://public.test:${port}/`, {
        allowedPorts: [port],
        resolver: async () => [{ address: '127.0.0.1', family: 4 }],
      }),
    ).rejects.toThrow(/adresse interne/);
  });

  it('constat 8 : identifiants retirés lors d’une redirection vers une autre origine', async () => {
    const res = await safeFetch(`http://public.test:${port}/to-other-origin`, {
      ...testOpts(),
      headers: {
        authorization: 'Bearer secret',
        'x-api-key': 'k',
        cookie: 'c=1',
        accept: 'text/plain',
      },
    });
    const seen = JSON.parse(res.body.toString()) as Record<string, string>;
    expect(seen.authorization).toBeUndefined();
    expect(seen['x-api-key']).toBeUndefined();
    expect(seen.cookie).toBeUndefined();
    expect(seen.accept).toBe('text/plain');
  });

  it('constat 8 : délai global, redirections comprises', async () => {
    await expect(
      safeFetch(`http://public.test:${port}/slow`, { ...testOpts(), totalTimeoutMs: 100 }),
    ).rejects.toThrow(/Délai global/);
  });

  it('limite la taille de la réponse', async () => {
    await expect(
      safeFetch(`http://public.test:${port}/big`, { ...testOpts(), maxBytes: 100 }),
    ).rejects.toThrow(/volumineuse/);
  });
});
