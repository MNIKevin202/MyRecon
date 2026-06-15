import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

const OPENAI_API_KEY = "openai.apiKey";
const OPENAI_MODEL = "openai.model";
const DEFAULT_MODEL = "gpt-5.5";

export type AiSettings = {
  hasApiKey: boolean;
  model: string;
};

export async function getAiSettings(): Promise<AiSettings> {
  const [keySetting, modelSetting] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: OPENAI_API_KEY } }),
    prisma.appSetting.findUnique({ where: { key: OPENAI_MODEL } }),
  ]);

  return {
    hasApiKey: Boolean(keySetting?.value || process.env.OPENAI_API_KEY),
    model: modelSetting?.value || process.env.OPENAI_MODEL || DEFAULT_MODEL,
  };
}

export async function getOpenAiCredentials() {
  const [keySetting, modelSetting] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: OPENAI_API_KEY } }),
    prisma.appSetting.findUnique({ where: { key: OPENAI_MODEL } }),
  ]);

  return {
    apiKey: keySetting?.value ? decryptSecret(keySetting.value) : process.env.OPENAI_API_KEY || "",
    model: modelSetting?.value || process.env.OPENAI_MODEL || DEFAULT_MODEL,
  };
}

export async function saveAiSettings(input: { apiKey?: string | null; model?: string | null; clearApiKey?: boolean }) {
  const model = (input.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;

  await prisma.appSetting.upsert({
    where: { key: OPENAI_MODEL },
    update: { value: model },
    create: { key: OPENAI_MODEL, value: model },
  });

  if (input.clearApiKey) {
    await prisma.appSetting.delete({ where: { key: OPENAI_API_KEY } }).catch(() => undefined);
  } else if (input.apiKey?.trim()) {
    await prisma.appSetting.upsert({
      where: { key: OPENAI_API_KEY },
      update: { value: encryptSecret(input.apiKey.trim()) },
      create: { key: OPENAI_API_KEY, value: encryptSecret(input.apiKey.trim()) },
    });
  }

  return getAiSettings();
}
