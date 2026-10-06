import { z } from 'zod';

const Miljoe = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL mangler'),
  KRYPTERINGSNOEGLE: z.string().transform((vaerdi, ctx) => {
    const noegle = Buffer.from(vaerdi, 'base64');
    if (noegle.length !== 32) {
      ctx.addIssue({ code: 'custom', message: 'KRYPTERINGSNOEGLE skal være 32 bytes base64' });
      return z.NEVER;
    }
    return noegle;
  }),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET skal være mindst 32 tegn'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Config = z.infer<typeof Miljoe>;

export function laesConfig(miljoe: NodeJS.ProcessEnv = process.env): Config {
  const resultat = Miljoe.safeParse(miljoe);
  if (!resultat.success) {
    const fejl = resultat.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Ugyldig konfiguration (se .env.example):\n${fejl}`);
  }
  return resultat.data;
}
