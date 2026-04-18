import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export { applyTaxToBaseIqd, netFromGrossIqd, taxAmountFromBase } from './tax-math';

const FILE = path.join(process.cwd(), 'data', 'tax-settings.json');

type TaxSettings = { ratePercent: number };

const DEFAULT: TaxSettings = { ratePercent: 0 };

async function readSettings(): Promise<TaxSettings> {
  try {
    const raw = await readFile(FILE, 'utf8');
    const data = JSON.parse(raw) as TaxSettings;
    if (typeof data.ratePercent !== 'number' || Number.isNaN(data.ratePercent)) {
      return { ...DEFAULT };
    }
    return { ratePercent: Math.max(0, Math.min(100, data.ratePercent)) };
  } catch {
    return { ...DEFAULT };
  }
}

/** VAT / sales tax applied on top of list prices (IQD). 0 = disabled. */
export async function getTaxRatePercent(): Promise<number> {
  const s = await readSettings();
  return s.ratePercent;
}

export async function setTaxRatePercent(rate: number): Promise<number> {
  const clamped = Math.max(0, Math.min(100, Math.round(rate * 100) / 100));
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, `${JSON.stringify({ ratePercent: clamped }, null, 2)}\n`, 'utf8');
  return clamped;
}

