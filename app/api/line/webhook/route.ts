import { NextResponse, type NextRequest } from "next/server";
import { verifyLineSignature } from "@/lib/line/verifySignature";
import { parseSalesReport } from "@/lib/line/parseMessage";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

type LineEvent = {
  type: string;
  message?: { id: string; type: string; text?: string };
  source?: { type: string; groupId?: string; userId?: string };
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events?: LineEvent[] };
  const events = body.events ?? [];
  const supabase = createServiceRoleClient();

  for (const event of events) {
    const groupId = event.source?.groupId ?? null;

    if (event.type !== "message" || event.message?.type !== "text") {
      await supabase.from("line_webhook_events").insert({
        line_message_id: event.message?.id ?? null,
        line_group_id: groupId,
        raw_payload: event,
        parse_status: "ignored",
      });
      continue;
    }

    const text = event.message.text ?? "";
    const messageId = event.message.id;
    const parsed = parseSalesReport(text);

    if (!parsed || !parsed.isWon) {
      await supabase.from("line_webhook_events").insert({
        line_message_id: messageId,
        line_group_id: groupId,
        raw_payload: event,
        parse_status: "ignored",
        parsed_staff_name: parsed?.staffName ?? null,
      });
      continue;
    }

    const { data: staff } = await supabase
      .from("staff_profiles")
      .select("id")
      .eq("display_name", parsed.staffName)
      .maybeSingle();

    if (!staff) {
      await supabase.from("line_webhook_events").insert({
        line_message_id: messageId,
        line_group_id: groupId,
        raw_payload: event,
        parse_status: "needs_review",
        parsed_staff_name: parsed.staffName,
      });
      continue;
    }

    const occurredAt = parsed.visitDate ?? todayIso();

    const { data: matchingPeriod } = await supabase
      .from("report_periods")
      .select("id")
      .eq("staff_id", staff.id)
      .eq("status", "draft")
      .lte("period_start", occurredAt)
      .gte("period_end", occurredAt)
      .maybeSingle();

    const { data: purchase, error: purchaseError } = await supabase
      .from("purchases")
      .upsert(
        {
          staff_id: staff.id,
          report_period_id: matchingPeriod?.id ?? null,
          amount: parsed.totalAmount,
          category: "line",
          item_note: `金・プラ:${parsed.kinPuraAmount} オーク:${parsed.aucAmount}`,
          source: "line",
          occurred_at: occurredAt,
          needs_review: false,
          line_message_id: messageId,
        },
        { onConflict: "line_message_id", ignoreDuplicates: true }
      )
      .select("id")
      .maybeSingle();

    await supabase.from("line_webhook_events").insert({
      line_message_id: messageId,
      line_group_id: groupId,
      raw_payload: event,
      parse_status: purchaseError ? "needs_review" : "parsed",
      parsed_staff_name: parsed.staffName,
      resulting_purchase_id: purchase?.id ?? null,
    });
  }

  return NextResponse.json({ ok: true });
}
