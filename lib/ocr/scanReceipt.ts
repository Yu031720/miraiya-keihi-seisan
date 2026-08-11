export type ReceiptScanResult = {
  amount: number | null;
  description: string | null;
  rawText: string;
};

const TOTAL_KEYWORDS = [
  "合計",
  "御合計",
  "ご合計",
  "お会計",
  "御会計",
  "合計金額",
  "総額",
  "お買上げ計",
  "お買上計",
  "御買上げ計",
  "total",
];

// 合計より大きくなりがちな「お預り」「お釣り」や、金額と紛らわしい電話番号・
// 登録番号などが書かれている行は、候補からまるごと除外する。
const EXCLUDE_LINE_KEYWORDS = [
  "預り",
  "預かり",
  "お釣り",
  "おつり",
  "釣り",
  "tel",
  "電話",
  "登録番号",
  "有効期限",
  "ポイント",
  "レジ",
  "店:",
  "会員",
  "no.",
  "no:",
];

function extractNumbers(text: string): number[] {
  const matches = text.match(/[¥￥]?\s?\d{1,3}(?:[,，]\d{3})+|\d{3,}/g) ?? [];
  return matches
    .map((m) => Number(m.replace(/[¥￥,，\s]/g, "")))
    .filter((n) => Number.isFinite(n) && n >= 10 && n <= 10000000);
}

function isExcludedLine(line: string): boolean {
  const lower = line.toLowerCase();
  return EXCLUDE_LINE_KEYWORDS.some((kw) => lower.includes(kw));
}

function guessAmount(text: string): number | null {
  const lines = text.split(/\r?\n/).filter((l) => !isExcludedLine(l));

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (TOTAL_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) {
      const sameLineNums = extractNumbers(lines[i]);
      if (sameLineNums.length > 0) {
        return Math.max(...sameLineNums);
      }
      // ラベルと金額が別行に分かれて認識された場合、直後の数行を見る
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const nextNums = extractNumbers(lines[j]);
        if (nextNums.length > 0) {
          return Math.max(...nextNums);
        }
      }
    }
  }

  const allNums = extractNumbers(lines.join("\n"));
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
  const formData = new FormData();
  formData.append("image", imageFile, "receipt.jpg");

  const res = await fetch("/api/ocr-receipt", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`OCRに失敗しました (${res.status})`);
  }

  const { text } = (await res.json()) as { text: string };

  return {
    amount: guessAmount(text),
    description: guessDescription(text),
    rawText: text,
  };
}
