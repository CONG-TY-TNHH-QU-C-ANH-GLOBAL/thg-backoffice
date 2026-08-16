import { z } from 'zod';

/**
 * The deployment's environment, validated once at boot.
 *
 * Fail-closed on purpose: a missing or malformed variable stops the process
 * instead of letting it start with a guessed default. A backoffice that boots
 * pointing at the wrong database is worse than one that refuses to boot.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),

  /**
   * One deployment, one database. That is the isolation boundary — there is no
   * tenant column and no tenant resolver anywhere in this codebase.
   */
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine((value) => value.startsWith('postgres://') || value.startsWith('postgresql://'), {
      message: 'DATABASE_URL must be a PostgreSQL connection string',
    }),

  LOG_LEVEL: z.enum(['error', 'warn', 'log', 'debug', 'verbose']).default('log'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Used by ConfigModule. Throws with every problem listed at once rather than
 * one per restart — a developer setting this up for the first time should see
 * the whole list.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${problems}\n\nSee .env.example.`);
  }

  return result.data;
}
