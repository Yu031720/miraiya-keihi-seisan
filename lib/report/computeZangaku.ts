export function computeZangaku(
  startingFloat: number,
  purchaseTotal: number,
  otherExpenseTotal: number
): number {
  return startingFloat - purchaseTotal - otherExpenseTotal;
}

export function computeTransferTotal(base: number, manualAddition: number): number {
  return base + manualAddition;
}
