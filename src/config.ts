import 'dotenv/config';

const looksLikeKey = (value: string) => /^sk-/i.test(value.trim());

function modelSetting(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  if (looksLikeKey(value)) {
    console.error(`${name} holds an API key, not a model name. Using ${fallback} instead. Put the key in the matching *_API_KEY variable.`);
    return fallback;
  }
  return value;
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  webUrl: required('WEB_URL', 'http://localhost:3000'),
  databaseUrl: required('DATABASE_URL'),
  authSecret: required('AUTH_SECRET'),
  cookieName: 'de_session',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  sessionDays: 7,
  magicLinkMinutes: 15,
  allowSignup: process.env.ALLOW_SIGNUP !== 'false',
  bootstrapAdmin: {
    email: process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() ?? '',
    password: process.env.SEED_ADMIN_PASSWORD ?? '',
  },
  emailServer: process.env.EMAIL_SERVER ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'Deck Eval <no-reply@deckeval.local>',
  storage: {
    driver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
    localDir: process.env.LOCAL_STORAGE_DIR ?? './storage',
    filesBaseUrl: process.env.FILES_BASE_URL ?? '/api/files',
    signedUrlSeconds: 3600,
    endpoint:
      process.env.R2_ENDPOINT ||
      (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : ''),
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    bucket: process.env.R2_BUCKET ?? 'deck-eval',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: modelSetting('ANTHROPIC_MODEL', 'claude-sonnet-5-5'),
    qcModel: modelSetting('ANTHROPIC_QC_MODEL', modelSetting('ANTHROPIC_MODEL', 'claude-sonnet-5-5')),
    baseUrl: process.env.ANTHROPIC_BASE_URL || undefined,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: modelSetting('OPENAI_MODEL', 'gpt-6.1-sol'),
    baseUrl: process.env.OPENAI_BASE_URL || undefined,
  },
  limits: {
    intakeBytes: 80 * 1024 * 1024,
    imageBytes: 15 * 1024 * 1024,
    docBytes: 25 * 1024 * 1024,
    webImageWidth: 1600,
  },
};
