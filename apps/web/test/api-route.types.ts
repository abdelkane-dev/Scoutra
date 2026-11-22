// Vérification de typage (exécutée par `pnpm typecheck`) : une route sans `action` ni
// `public: true` ne compile pas (revue étape 1, constat 14).
import { apiRoute, json } from '../src/server/http';

// @ts-expect-error : ni action ni public
export const missing = apiRoute({}, async () => json({}));
// @ts-expect-error : action inconnue
export const unknownAction = apiRoute({ action: 'tout:faire' }, async () => json({}));
// @ts-expect-error : public ET action à la fois
export const both = apiRoute({ public: true, action: 'org:read' }, async () => json({}));
export const ok = apiRoute({ action: 'org:read' }, async ({ ctx }) => json({ org: ctx.orgId }));
export const pub = apiRoute({ public: true }, async ({ ctx }) => json({ ctx }));
