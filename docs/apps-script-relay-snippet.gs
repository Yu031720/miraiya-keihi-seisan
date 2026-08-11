// ↓↓↓ 既存のApps Scriptの「LINEに送信する処理」の直後に、この関数呼び出しを追加してください ↓↓↓
//
// 使い方の例:
//   sendToKeihiApp("中村", 3000, "2026-08-09", "オーク");
//
// staffName  : 経費精算アプリに登録されているスタッフの「担当者名」と完全一致させてください(例: "中村")
// amount     : 買取金額(円、数値)
// occurredAt : 買取日("YYYY-MM-DD"形式)。省略した場合は当日扱いになります
// note       : メモ(任意)。省略可

function sendToKeihiApp(staffName, amount, occurredAt, note) {
  var url = "https://miraiya-keihi-seisan.vercel.app/api/purchase-webhook";
  var secret = "f9fc42d11dee0fa76e571e00348a3f153024242596842fb7";

  var payload = {
    staffName: staffName,
    amount: amount,
    occurredAt: occurredAt || null,
    note: note || null,
  };

  try {
    UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: { "X-Webhook-Secret": secret },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true, // 経費アプリ側でエラーが起きても、LINE送信処理は止めない
    });
  } catch (e) {
    // 経費アプリへの送信に失敗しても、既存のLINE通知処理には影響させない
    Logger.log("経費精算アプリへの送信に失敗しました: " + e);
  }
}
