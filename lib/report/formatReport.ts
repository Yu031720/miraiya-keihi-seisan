import { formatYen } from "@/lib/report/formatCurrency";

function formatDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${m}/${d}`;
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
    displayName,
    `期間：${formatDate(periodStart)}〜${formatDate(periodEnd)}`,
    `残金：${formatYen(zangaku)}`,
    `経費：${formatYen(otherExpenseTotal)}`,
    `振込：${formatYen(transferTotal)}`,
    ``,
    `ご確認お願い致します！`,
  ].join("\n");
}
