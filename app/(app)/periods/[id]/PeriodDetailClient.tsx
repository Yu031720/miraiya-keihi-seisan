"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { computeZangaku, computeTransferTotal } from "@/lib/report/computeZangaku";
import { formatReport } from "@/lib/report/formatReport";
import { formatYen } from "@/lib/report/formatCurrency";
import { scanReceipt } from "@/lib/ocr/scanReceipt";
import type { Database } from "@/lib/supabase/types";

type Period = Database["public"]["Tables"]["report_periods"]["Row"];
type Purchase = Database["public"]["Tables"]["purchases"]["Row"];
type Expense = Database["public"]["Tables"]["other_expenses"]["Row"];

export function PeriodDetailClient({
  period,
  initialPurchases,
  initialExpenses,
  displayName,
  staffId,
  unclaimedCount = 0,
}: {
  period: Period;
  initialPurchases: Purchase[];
  initialExpenses: Expense[];
  displayName: string;
  staffId: string;
  unclaimedCount?: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [deletingPeriod, setDeletingPeriod] = useState(false);

  const [startingFloat, setStartingFloat] = useState(period.starting_float);
  const [transferBase, setTransferBase] = useState(period.transfer_base);
  const [transferManualAddition, setTransferManualAddition] = useState(
    period.transfer_manual_addition
  );
  const [purchases, setPurchases] = useState<Purchase[]>(initialPurchases);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);

  const [newPurchaseAmount, setNewPurchaseAmount] = useState("");
  const [newPurchaseNote, setNewPurchaseNote] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseDescription, setNewExpenseDescription] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const [savingHeader, setSavingHeader] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchaseTotal = purchases.reduce((sum, p) => sum + p.amount, 0);
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const zangaku = computeZangaku(startingFloat, purchaseTotal, expenseTotal);
  const transferTotal = computeTransferTotal(transferBase, transferManualAddition);

  const reportText = formatReport({
    displayName,
    periodStart: period.period_start,
    periodEnd: period.period_end,
    zangaku,
    otherExpenseTotal: expenseTotal,
    transferTotal,
  });

  async function saveHeaderFields(fields: Partial<Period>) {
    setSavingHeader(true);
    setError(null);
    const { error } = await supabase.from("report_periods").update(fields).eq("id", period.id);
    setSavingHeader(false);
    if (error) setError(error.message);
  }

  async function addPurchase(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = Number(newPurchaseAmount);
    if (!amount || amount <= 0) {
      setError("買取金額を正しく入力してください。");
      return;
    }
    const { data, error } = await supabase
      .from("purchases")
      .insert({
        staff_id: staffId,
        report_period_id: period.id,
        amount,
        item_note: newPurchaseNote || null,
        source: "manual",
      })
      .select("*")
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setPurchases((prev) => [...prev, data]);
    setNewPurchaseAmount("");
    setNewPurchaseNote("");
  }

  async function deletePurchase(id: string) {
    const prev = purchases;
    setPurchases(purchases.filter((p) => p.id !== id));
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) {
      setError(error.message);
      setPurchases(prev);
    }
  }

  async function handleReceiptSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setReceiptFile(file);
    setReceiptPreviewUrl(URL.createObjectURL(file));
    setScanningReceipt(true);
    try {
      const result = await scanReceipt(file);
      if (result.amount && !newExpenseAmount) {
        setNewExpenseAmount(String(result.amount));
      }
      if (result.description && !newExpenseDescription) {
        setNewExpenseDescription(result.description);
      }
    } catch {
      setError("レシートの読み取りに失敗しました。金額・内容を手入力してください。");
    } finally {
      setScanningReceipt(false);
    }
  }

  function clearReceiptSelection() {
    setReceiptFile(null);
    setReceiptPreviewUrl(null);
    if (receiptInputRef.current) receiptInputRef.current.value = "";
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = Number(newExpenseAmount);
    if (!amount || amount <= 0) {
      setError("経費金額を正しく入力してください。");
      return;
    }

    setAddingExpense(true);
    let receiptPath: string | null = null;
    if (receiptFile) {
      const ext = receiptFile.name.split(".").pop() || "jpg";
      const path = `${staffId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(path, receiptFile);
      if (uploadError) {
        setAddingExpense(false);
        setError(`レシート画像のアップロードに失敗しました: ${uploadError.message}`);
        return;
      }
      receiptPath = path;
    }

    const { data, error } = await supabase
      .from("other_expenses")
      .insert({
        staff_id: staffId,
        report_period_id: period.id,
        amount,
        description: newExpenseDescription,
        receipt_path: receiptPath,
      })
      .select("*")
      .single();
    setAddingExpense(false);
    if (error) {
      setError(error.message);
      return;
    }
    setExpenses((prev) => [...prev, data]);
    setNewExpenseAmount("");
    setNewExpenseDescription("");
    clearReceiptSelection();
  }

  async function viewReceipt(path: string) {
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(path, 60);
    if (error || !data) {
      setError("レシート画像を開けませんでした。");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function deleteExpense(id: string) {
    const prev = expenses;
    setExpenses(expenses.filter((e) => e.id !== id));
    const { error } = await supabase.from("other_expenses").delete().eq("id", id);
    if (error) {
      setError(error.message);
      setExpenses(prev);
    }
  }

  async function handleFinalize() {
    setError(null);
    const { error } = await supabase
      .from("report_periods")
      .update({
        starting_float: startingFloat,
        transfer_base: transferBase,
        transfer_manual_addition: transferManualAddition,
        computed_zangaku: zangaku,
        generated_text: reportText,
        status: "finalized",
      })
      .eq("id", period.id);
    if (error) {
      setError(error.message);
      return;
    }
    window.location.reload();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDeletePeriod() {
    if (!window.confirm("この下書き期間を削除しますか?入力した買取・経費データは削除されず、未所属に戻ります。")) {
      return;
    }
    setDeletingPeriod(true);
    const { error } = await supabase.from("report_periods").delete().eq("id", period.id);
    setDeletingPeriod(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const isFinalized = period.status === "finalized";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-zinc-900">
          {period.period_start} 〜 {period.period_end}
        </h1>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              isFinalized ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {isFinalized ? "確定済み" : "下書き"}
          </span>
          {!isFinalized && (
            <button
              onClick={handleDeletePeriod}
              disabled={deletingPeriod}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              {deletingPeriod ? "削除中..." : "この期間を削除"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isFinalized && unclaimedCount > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          この期間はすでに確定済みですが、この期間の日付範囲に該当する未反映の買取データが
          {unclaimedCount}件あります(確定後に自動取込されたため、報告済みの金額を変えないようここには反映していません)。
          必要であれば内容を確認し、次の期間に含めるなど手動で対応してください。
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <label className="block text-sm font-medium text-zinc-700">
          元手(この週の開始時点の手持ち現金)
        </label>
        <input
          type="number"
          disabled={isFinalized}
          value={startingFloat}
          onChange={(e) => setStartingFloat(Number(e.target.value))}
          onBlur={() => saveHeaderFields({ starting_float: startingFloat })}
          className="mt-1 w-48 rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="font-semibold text-zinc-900">買取</h2>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} className="border-t border-zinc-100">
                <td className="py-2 text-zinc-700">
                  {p.item_note || "-"}
                  {p.source === "line" && (
                    <span className="ml-2 rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700">
                      自動取込
                    </span>
                  )}
                </td>
                <td className="py-2 text-right font-medium">{formatYen(p.amount)}</td>
                <td className="py-2 pl-3 text-right">
                  {!isFinalized && (
                    <button
                      onClick={() => deletePurchase(p.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      削除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 text-sm font-semibold">
          <span>買取合計({purchases.length}件)</span>
          <span>{formatYen(purchaseTotal)}</span>
        </div>

        {!isFinalized && (
          <form onSubmit={addPurchase} className="mt-4 flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs text-zinc-500">金額</label>
              <input
                type="number"
                value={newPurchaseAmount}
                onChange={(e) => setNewPurchaseAmount(e.target.value)}
                className="w-32 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500">メモ(任意)</label>
              <input
                type="text"
                value={newPurchaseNote}
                onChange={(e) => setNewPurchaseNote(e.target.value)}
                placeholder="例: 腕時計"
                className="w-40 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-md border border-orange-300 bg-white px-3 py-1.5 text-sm font-medium text-orange-600 hover:bg-orange-50"
            >
              追加
            </button>
          </form>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="font-semibold text-zinc-900">その他の経費</h2>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {expenses.map((exp) => (
              <tr key={exp.id} className="border-t border-zinc-100">
                <td className="py-2 text-zinc-700">
                  {exp.description}
                  {exp.receipt_path && (
                    <button
                      onClick={() => viewReceipt(exp.receipt_path!)}
                      className="ml-2 text-xs text-zinc-400 underline hover:text-zinc-700"
                    >
                      レシート
                    </button>
                  )}
                </td>
                <td className="py-2 text-right font-medium">{formatYen(exp.amount)}</td>
                <td className="py-2 pl-3 text-right">
                  {!isFinalized && (
                    <button
                      onClick={() => deleteExpense(exp.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      削除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 text-sm font-semibold">
          <span>その他の経費合計</span>
          <span>{formatYen(expenseTotal)}</span>
        </div>

        {!isFinalized && (
          <form onSubmit={addExpense} className="mt-4 flex flex-col gap-3">
            <div>
              <label className="block text-xs text-zinc-500">レシート写真(任意・自動で金額を読み取ります)</label>
              <div className="mt-1 flex items-center gap-3">
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleReceiptSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => receiptInputRef.current?.click()}
                  className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  {receiptFile ? "写真を変更する" : "写真を撮る・選ぶ"}
                </button>
                {scanningReceipt && <span className="text-xs text-zinc-400">読み取り中...</span>}
              </div>
              {receiptPreviewUrl && (
                <div className="mt-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={receiptPreviewUrl} alt="レシートプレビュー" className="h-20 w-20 rounded border border-zinc-200 object-cover" />
                  <button
                    type="button"
                    onClick={clearReceiptSelection}
                    className="text-xs text-zinc-400 hover:text-red-600"
                  >
                    写真を取り消す
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs text-zinc-500">金額</label>
                <input
                  type="number"
                  value={newExpenseAmount}
                  onChange={(e) => setNewExpenseAmount(e.target.value)}
                  className="w-32 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={addingExpense}
                className="rounded-md border border-orange-300 bg-white px-3 py-1.5 text-sm font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50"
              >
                {addingExpense ? "追加中..." : "追加"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="font-semibold text-zinc-900">振込金額</h2>
        <div className="mt-3 flex gap-4">
          <div>
            <label className="block text-xs text-zinc-500">基本額</label>
            <input
              type="number"
              disabled={isFinalized}
              value={transferBase}
              onChange={(e) => setTransferBase(Number(e.target.value))}
              onBlur={() => saveHeaderFields({ transfer_base: transferBase })}
              className="w-32 rounded-md border border-zinc-300 px-2 py-1.5 text-sm disabled:bg-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500">手動追加</label>
            <input
              type="number"
              disabled={isFinalized}
              value={transferManualAddition}
              onChange={(e) => setTransferManualAddition(Number(e.target.value))}
              onBlur={() => saveHeaderFields({ transfer_manual_addition: transferManualAddition })}
              className="w-32 rounded-md border border-zinc-300 px-2 py-1.5 text-sm disabled:bg-zinc-100"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border-2 border-orange-200 bg-white p-6">
        <h2 className="font-semibold text-zinc-900">報告文</h2>
        <pre className="mt-3 whitespace-pre-wrap rounded-md bg-zinc-50 p-4 text-sm">
          {reportText}
        </pre>
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleCopy}
            className="rounded-md border border-orange-300 bg-white px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50"
          >
            {copied ? "コピーしました" : "コピー"}
          </button>
          {!isFinalized && (
            <button
              onClick={handleFinalize}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-orange-400 hover:text-orange-600"
            >
              確定する
            </button>
          )}
        </div>
        {savingHeader && <p className="mt-2 text-xs text-zinc-400">保存中...</p>}
      </section>
    </div>
  );
}
