import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PeriodDetailClient } from "./PeriodDetailClient";

export default async function PeriodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: period } = await supabase.from("report_periods").select("*").eq("id", id).single();

  if (!period) {
    notFound();
  }

  // LINE/Apps Script経由で取り込まれ、まだどの期間にも紐付いていない自分の
  // 買取のうち、この期間の日付範囲に収まるものをこの期間に紐付ける(取り込み
  // 時に期間が未作成だった場合の救済措置)。確定済みの期間には自動で紐付け
  // ない(報告済みの金額が後から黙って変わるのを防ぐため)。
  let unclaimedCount = 0;
  if (period.status === "draft") {
    await supabase
      .from("purchases")
      .update({ report_period_id: id })
      .eq("staff_id", user!.id)
      .is("report_period_id", null)
      .gte("occurred_at", period.period_start)
      .lte("occurred_at", period.period_end);
  } else {
    const { count } = await supabase
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("staff_id", user!.id)
      .is("report_period_id", null)
      .gte("occurred_at", period.period_start)
      .lte("occurred_at", period.period_end);
    unclaimedCount = count ?? 0;
  }

  const [{ data: purchases }, { data: expenses }, { data: profile }] = await Promise.all([
    supabase
      .from("purchases")
      .select("*")
      .eq("report_period_id", id)
      .order("occurred_at", { ascending: true }),
    supabase
      .from("other_expenses")
      .select("*")
      .eq("report_period_id", id)
      .order("expense_date", { ascending: true }),
    supabase.from("staff_profiles").select("display_name").eq("id", user!.id).single(),
  ]);

  return (
    <PeriodDetailClient
      period={period}
      initialPurchases={purchases ?? []}
      initialExpenses={expenses ?? []}
      displayName={profile?.display_name ?? ""}
      staffId={user!.id}
      unclaimedCount={unclaimedCount}
    />
  );
}
