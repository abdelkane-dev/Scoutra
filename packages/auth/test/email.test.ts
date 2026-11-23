import { describe, expect, it } from 'vitest';
import { buildEmail, createEmailSender, createResendEmailSender } from '../src/email';

describe('transport email', () => {
  it('construit un message texte bilingue contenant le lien', () => {
    const m = buildEmail({ to: 'a@b.co', kind: 'verify_email', url: 'https://app.test/v?t=1' });
    expect(m.text).toContain('https://app.test/v?t=1');
    expect(m.subject).toMatch(/Scoutra/);
  });

  it('envoie via Resend avec la clé en en-tête et sans fuite dans le corps', async () => {
    const calls: { url: string; headers?: Record<string, string>; body?: string }[] = [];
    const sender = createResendEmailSender({
      apiKey: 're_test_1234567890',
      from: 'Scoutra <noreply@scoutra.ai>',
      fetcher: async (url, o) => {
        calls.push({ url, headers: o.headers, body: o.body });
        return { status: 200 };
      },
    });
    await sender.send({ to: 'x@y.co', kind: 'invitation', url: 'https://app.test/i/1' });
    expect(calls[0]?.url).toBe('https://api.resend.com/emails');
    expect(calls[0]?.headers?.authorization).toBe('Bearer re_test_1234567890');
    expect(calls[0]?.body).not.toContain('re_test_1234567890');
    expect(JSON.parse(calls[0]!.body!).to).toEqual(['x@y.co']);
  });

  it('échoue clairement si le prestataire refuse', async () => {
    const sender = createResendEmailSender({
      apiKey: 're_test_1234567890',
      from: 'noreply@scoutra.ai',
      fetcher: async () => ({ status: 422 }),
    });
    await expect(
      sender.send({ to: 'x@y.co', kind: 'reset_password', url: 'https://app.test/r' }),
    ).rejects.toThrow(/422/);
  });

  it('refuse le transport console en production sans configuration', async () => {
    const sender = createEmailSender({ NODE_ENV: 'production' });
    await expect(
      sender.send({ to: 'x@y.co', kind: 'verify_email', url: 'https://app.test/v' }),
    ).rejects.toThrow(/production/);
  });
});
