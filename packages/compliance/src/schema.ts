import { z } from 'zod';
import { CONTACT_CHANNELS } from '@scoutra/core';

export const OUTCOMES = [
  'allow',
  'allow_with_conditions',
  'deny_unless_consent',
  'manual_only',
  'deny',
] as const;

export const conditionsSchema = z
  .object({
    requireOptOut: z.boolean().optional(),
    requireIdentification: z.boolean().optional(),
    requirePostalAddress: z.boolean().optional(),
    requirePublishedAddress: z.boolean().optional(),
    requireAuthorityDeclaration: z.boolean().optional(),
    checkDoNotCall: z.boolean().optional(),
    manualSendOnly: z.boolean().optional(),
    footer: z
      .enum(['eu_notice', 'uk_notice', 'ca_notice', 'us_notice', 'generic_notice'])
      .optional(),
  })
  .strict();
export type Conditions = z.infer<typeof conditionsSchema>;

export const ruleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{3,60}$/),
    audience: z.enum(['individual', 'business']).optional(),
    channels: z.array(z.enum(CONTACT_CHANNELS)).min(1),
    outcome: z.enum(OUTCOMES),
    conditions: conditionsSchema.optional(),
  })
  .strict();

export const rulesetSchema = z
  .object({
    jurisdiction: z.string().regex(/^([A-Z]{2}|EU|ECOWAS|DEFAULT)$/),
    version: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    members: z.array(z.string().regex(/^[A-Z]{2}$/)).optional(),
    sources: z.array(z.string()).min(1),
    retentionDays: z.int().positive(),
    maxFollowUps: z.int().min(0),
    rules: z.array(ruleSchema).min(1),
  })
  .strict();
export type Ruleset = z.infer<typeof rulesetSchema>;
