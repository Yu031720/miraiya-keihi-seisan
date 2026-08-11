import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

type PurchasePayload = {
  staffName?: string;
  amount?: number;
  occurredAt?: string;
  note?: string;
  requestId?: string;
  rawText?: string;
  imageUrls?: string[];
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// 社内アプリがLINEに流している「受注速報」文面を解析する。
// 例: 先頭行「【中村】」が担当者名、「アポ訪問日：2026-08-11」「金・プラ買取金額：12000」
// 「オーク買取金額：3000」「ステータス：受注」のような行が並ぶ。
function parseReportText(text: string) {
  const staffMatch = text.match(/^【([^】]+)】/);
  const statusMatch = text.match(/ステータス[:：]\s*(\S+)/);
  const dateMatch = text.match(/アポ訪問日[:：]\s*(\d{4}-\d{2}-\d{2})/);
  const kinPuraMatch = text.match(/金・プラ買取金額[:：]\s*([\d,]+)/);
  const aucMatch = text.match(/オーク買取金額[:：]\s*([\d,]+)/);
  const kinPura = kinPuraMatch ? parseInt(kinPuraMatch[1].replace(/,/g, ""), 10) : 0;
  const auc = aucMatch ? parseInt(aucMatch[1].replace(/,/g, ""), 10) : 0;
  return {
    staffName: staffMatch ? staffMatch[1].trim() : null,
    amount: kinPura + auc,
    occurredAt: dateMatch ? dateMatch[1] : null,
    status: statusMatch ? statusMatch[1] : null,
  };
}

export async function POST(request: NextRequest) {
  const secret = process.env.PURCHASE_WEBHOOK_SECRET;
  const providedSecret = request.headers.get("x-webhook-secret");
  if (!secret || providedSecret !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const bodyText = await request.text();
  let body: PurchasePayload;
  try {
    body = JSON.parse(bodyText) as PurchasePayload;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  if (body.rawText && (!body.staffName || typeof body.amount !== "number")) {
    const parsed = parseReportText(body.rawText);

    if (!parsed.status?.includes("受注") || parsed.amount === 0) {
      await supabase.from("line_webhook_events").insert({
        line_message_id: body.requestId ?? null,
        raw_payload: body as unknown as object,
        parse_status: "ignored",
        parsed_staff_name: parsed.staffName,
      });
      return NextResponse.json({ ok: true, skipped: true });
    }

    if (parsed.staffName) body.staffName = parsed.staffName;
    if (parsed.amount > 0) body.amount = parsed.amount;
    if (parsed.occurredAt) body.occurredAt = parsed.occurredAt;
  }

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
