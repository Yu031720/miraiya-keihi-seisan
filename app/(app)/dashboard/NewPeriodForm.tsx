"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { start: string; end: string } {
  const today = new Date();
  const day = today.getDay(); // 0=日
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: isoDate(monday), end: isoDate(sunday) };
}

export function NewPeriodForm({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const range = defaultRange();
  const [periodStart, setPeriodStart] = useState(range.start);
  const [periodEnd, setPeriodEnd] = useState(range.end);
  const [startingFloat, setStartingFloat] = useState("300000");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setError("ログイン情報が確認できません。再度ログインしてください。");
      return;
    }

    const { data, error } = await supabase
      .from("report_periods")
      .insert({
        staff_id: user.id,
        period_start: periodStart,
        period_end: periodEnd,
        starting_float: Number(startingFloat) || 0,
      })
      .select("id")
      .single();

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    onCreated?.();
    router.push(`/periods/${data.id}`);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        + 新しい期間を作成
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6"
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">期間開始</label>
          <input
            type="date"
            required
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">期間終了</label>
          <input
            type="date"
            required
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">元手(この週の開始時点の手持ち現金)</label>
        <input
          type="number"
          required
          value={startingFloat}
          onChange={(e) => setStartingFloat(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "作成中..." : "作成する"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-800"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
