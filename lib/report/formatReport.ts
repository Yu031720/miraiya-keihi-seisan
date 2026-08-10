import { formatYen } from "@/lib/report/formatCurrency";

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${y}/${m}/${d}`;
}

export function formatReport(params: {
  displayName: string;
  periodStart: string;
  periodEnd: string;
  zangaku: number;
  otherExpenseTotal: number;
  transferTotal: number;
}): string {
  const { displayName, periodStart, periodEnd, zangaku, otherExpenseTotal, transferTotal } = params;
  return [
    `担当者名：${displayName}`,
    `期間：${formatDate(periodStart)}〜${formatDate(periodEnd)}`,
    `残金：${formatYen(zangaku)}`,
    `その他の経費：${formatYen(otherExpenseTotal)}`,
    `振込金額：${formatYen(transferTotal)}`,
  ].join("\n");
}
