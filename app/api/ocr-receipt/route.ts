import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type GoogleVisionResponse = {
  responses?: {
    fullTextAnnotation?: { text?: string };
    error?: { message?: string };
  }[];
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OCR is not configured" }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "image is required" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64Image = Buffer.from(bytes).toString("base64");

  const googleResponse = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: { languageHints: ["ja"] },
          },
        ],
      }),
    }
  );

  if (!googleResponse.ok) {
    const errorText = await googleResponse.text();
    return NextResponse.json({ error: `Google Vision error: ${errorText}` }, { status: 502 });
  }

  const result = (await googleResponse.json()) as GoogleVisionResponse;
  const firstResult = result.responses?.[0];
  if (firstResult?.error) {
    return NextResponse.json(
      { error: `Google Vision error: ${firstResult.error.message}` },
      { status: 502 }
    );
  }

  const text = firstResult?.fullTextAnnotation?.text ?? "";
  return NextResponse.json({ text });
}
