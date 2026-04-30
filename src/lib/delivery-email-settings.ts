import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getDataRoot } from '@/lib/data-root';

const FILE = path.join(getDataRoot(), 'delivery-email-settings.json');

type DeliveryEmailSettings = {
  enabled: boolean;
};

const DEFAULTS: DeliveryEmailSettings = {
  enabled: false,
};

export async function isDeliveryEmailEnabled(): Promise<boolean> {
  try {
    const raw = await readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DeliveryEmailSettings>;
    return parsed.enabled === true;
  } catch {
    return DEFAULTS.enabled;
  }
}

export async function setDeliveryEmailEnabled(enabled: boolean): Promise<boolean> {
  const next: DeliveryEmailSettings = { enabled };
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next.enabled;
}
