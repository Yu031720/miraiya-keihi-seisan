import { createWorker } from "tesseract.js";

export type ReceiptScanResult = {
  amount: number | null;
  description: string | null;
  rawText: string;
};

const TOTAL_KEYWORDS = ["合計", "御合計", "ご合計", "お会計", "合計金額", "総額", "total"];

function extractNumbers(text: string): number[] {
  const matches = text.match(/[¥￥]?\s?\d{1,3}(?:[,，]\d{3})+|\d{3,}/g) ?? [];
  return matches
    .map((m) => Number(m.replace(/[¥￥,，\s]/g, "")))
    .filter((n) => Number.isFinite(n) && n >= 10 && n <= 10000000);
}

function guessAmount(text: string): number | null {
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (TOTAL_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) {
      const nums = extractNumbers(line);
      if (nums.length > 0) {
        return Math.max(...nums);
      }
    }
  }

  const allNums = extractNumbers(text);
  if (allNums.length === 0) return null;
  return Math.max(...allNums);
}

function guessDescription(text: string): string | null {
  const firstLine = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length >= 2 && l.length <= 30);
  return firstLine ?? null;
}

export async function scanReceipt(imageFile: File | Blob): Promise<ReceiptScanResult> {
  const worker = await createWorker("jpn");
  try {
    const {
      data: { text },
    } = await worker.recognize(imageFile);
    return {
      amount: guessAmount(text),
      description: guessDescription(text),
      rawText: text,
    };
  } finally {
    await worker.terminate();
  }
}
