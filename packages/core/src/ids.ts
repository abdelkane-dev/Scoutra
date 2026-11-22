import { z } from 'zod';

/** Identifiant UUID (organisations, utilisateurs, lignes métier). */
export const uuidSchema = z.uuid();
export type Uuid = z.infer<typeof uuidSchema>;

export const orgIdSchema = uuidSchema.describe('organization_id');
