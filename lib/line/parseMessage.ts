export type ParsedSalesReport = {
  staffName: string;
  status: string;
  isWon: boolean;
  kinPuraAmount: number;
  aucAmount: number;
  totalAmount: number;
  visitDate: string | null;
};

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(raw.replace(/[,，¥￥\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Sales Performerが投稿する「【担当者名】...【内容】...【コメント】...【担当者名 N月累計】...」
 * という形式のメッセージから、個別取引ブロック(累計ブロックは除く)を1件だけ解析する。
 */
export function parseSalesReport(text: string): ParsedSalesReport | null {
  const headerMatch = text.match(/【([^\d【】]+?)】/);
  if (!headerMatch) return null;
  const staffName = headerMatch[1].trim();

  const cumulativeIndex = text.search(/【[^【】]*累計[^【】]*】/);
  const body = cumulativeIndex === -1 ? text : text.slice(0, cumulativeIndex);

  const statusMatch = body.match(/ステータス[：:]\s*(\S+)/);
  const status = statusMatch ? statusMatch[1].trim() : "";

  const kinPuraMatch = body.match(/金[・･]プラ買取金額[：:]\s*([\d,，]+)/);
  const aucMatch = body.match(/オーク買取金額[：:]\s*([\d,，]+)/);
  const visitDateMatch = body.match(/アポ訪問日[：:]\s*(\d{4}-\d{2}-\d{2})/);

  const kinPuraAmount = parseAmount(kinPuraMatch?.[1]);
  const aucAmount = parseAmount(aucMatch?.[1]);

  return {
    staffName,
    status,
    isWon: status === "受注",
    kinPuraAmount,
    aucAmount,
    totalAmount: kinPuraAmount + aucAmount,
    visitDate: visitDateMatch?.[1] ?? null,
  };
}
