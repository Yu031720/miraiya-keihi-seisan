import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewPeriodForm } from "./NewPeriodForm";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: periods } = await supabase
    .from("report_periods")
    .select("id, period_start, period_end, status")
    .eq("staff_id", user!.id)
    .order("period_start", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-zinc-900">期間一覧</h1>
      </div>

      <NewPeriodForm />

      <div className="flex flex-col gap-2">
        {periods && periods.length > 0 ? (
          periods.map((p) => (
            <Link
              key={p.id}
              href={`/periods/${p.id}`}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-400"
            >
              <span className="text-sm text-zinc-900">
                {p.period_start} 〜 {p.period_end}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  p.status === "finalized"
                    ? "bg-green-100 text-green-700"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {p.status === "finalized" ? "確定済み" : "下書き"}
              </span>
            </Link>
          ))
        ) : (
          <p className="text-sm text-zinc-500">まだ期間がありません。上のボタンから作成してください。</p>
        )}
      </div>
    </div>
  );
}
