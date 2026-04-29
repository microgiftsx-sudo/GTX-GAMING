import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getDataRoot } from '@/lib/data-root';

const FILE = path.join(getDataRoot(), 'email-notify-state.json');

type NotifyState = {
  welcomedEmails: string[];
};

async function readState(): Promise<NotifyState> {
  try {
    const raw = await readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw) as NotifyState;
    return {
      welcomedEmails: Array.isArray(parsed?.welcomedEmails)
        ? parsed.welcomedEmails.filter((x) => typeof x === 'string')
        : [],
    };
  } catch {
    return { welcomedEmails: [] };
  }
}

async function writeState(state: NotifyState): Promise<void> {
  await mkdir(getDataRoot(), { recursive: true });
  await writeFile(FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export async function markEmailWelcomedOnce(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return false;
  const state = await readState();
  if (state.welcomedEmails.includes(normalized)) return false;
  state.welcomedEmails.push(normalized);
  await writeState(state);
  return true;
}

