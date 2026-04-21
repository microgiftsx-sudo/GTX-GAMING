import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getDataRoot } from '@/lib/data-root';

export type TelegramLang = 'ar' | 'en';

type Store = Record<string, TelegramLang>;

const FILE = path.join(getDataRoot(), 'telegram-language.json');

async function readStore(): Promise<Store> {
  try {
    const raw = await readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeStore(store: Store) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export async function getTelegramUserLang(userId: number): Promise<TelegramLang> {
  const store = await readStore();
  return store[String(userId)] === 'ar' ? 'ar' : 'en';
}

export async function setTelegramUserLang(userId: number, lang: TelegramLang): Promise<void> {
  const store = await readStore();
  store[String(userId)] = lang;
  await writeStore(store);
}
