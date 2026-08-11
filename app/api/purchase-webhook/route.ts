import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

type PurchasePayload = {
  staffName?: string;
  amount?: number;
  occurredAt?: string;
  note?: string;
  requestId?: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const secret = process.env.PURCHASE_WEBHOOK_SECRET;
  const providedSecret = request.headers.get("x-webhook-secret");
  if (!secret || providedSecret !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rawText = await request.text();
  let body: PurchasePayload;
  try {
    body = JSON.parse(rawText) as PurchasePayload;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  if (!body.staffName || typeof body.amount !== "number" || !(body.amount > 0)) {
    await supabase.from("line_webhook_events").insert({
      line_message_id: body.requestId ?? null,
      raw_payload: body as unknown as object,
      parse_status: "needs_review",
      parsed_staff_name: body.staffName ?? null,
    });
    return NextResponse.json({ error: "staffName and positive amount are required" }, { status: 400 });
  }

  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("id")
    .eq("display_name", body.staffName)
    .maybeSingle();

  if (!staff) {
    await supabase.from("line_webhook_events").insert({
      line_message_id: body.requestId ?? null,
      raw_payload: body as unknown as object,
      parse_status: "needs_review",
      parsed_staff_name: body.staffName,
    });
    return NextResponse.json({ error: `unknown staffName: ${body.staffName}` }, { status: 200 });
  }

  const occurredAt = body.occurredAt ?? todayIso();

  const { data: matchingPeriod } = await supabase
    .from("report_periods")
    .select("id")
    .eq("staff_id", staff.id)
    .eq("status", "draft")
    .lte("period_start", occurredAt)
    .gte("period_end", occurredAt)
    .maybeSingle();

  const insertPayload: {
    staff_id: string;
    report_period_id: string | null;
    amount: number;
    category: string;
    item_note: string | null;
    source: "line";
    occurred_at: string;
    needs_review: boolean;
    line_message_id?: string;
  } = {
    staff_id: staff.id,
    report_period_id: matchingPeriod?.id ?? null,
    amount: body.amount,
    category: "app",
    item_note: body.note ?? null,
    source: "line",
    occurred_at: occurredAt,
    needs_review: false,
  };
  if (body.requestId) {
    insertPayload.line_message_id = body.requestId;
  }

  const query = body.requestId
    ? supabase.from("purchases").upsert(insertPayload, { onConflict: "line_message_id", ignoreDuplicates: true })
    : supabase.from("purchases").insert(insertPayload);

  const { data: purchase, error: purchaseError } = await query.select("id").maybeSingle();

  await supabase.from("line_webhook_events").insert({
    line_message_id: body.requestId ?? null,
    raw_payload: body as unknown as object,
    parse_status: purchaseError ? "needs_review" : "parsed",
    parsed_staff_name: body.staffName,
    resulting_purchase_id: purchase?.id ?? null,
  });

  if (purchaseError) {
    return NextResponse.json({ error: purchaseError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
