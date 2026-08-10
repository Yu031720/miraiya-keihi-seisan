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

  const [{ data: period }, { data: purchases }, { data: expenses }, { data: profile }] =
    await Promise.all([
      supabase.from("report_periods").select("*").eq("id", id).single(),
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

  if (!period) {
    notFound();
  }

  return (
    <PeriodDetailClient
      period={period}
      initialPurchases={purchases ?? []}
      initialExpenses={expenses ?? []}
      displayName={profile?.display_name ?? ""}
      staffId={user!.id}
    />
  );
}
