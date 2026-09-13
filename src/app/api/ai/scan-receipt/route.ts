import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Simple in-memory rate limiting (resets on server restart)
const dailyScans: Record<string, { count: number; date: string }> = {};
const DAILY_LIMIT = 10;

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const record = dailyScans[userId];

  if (!record || record.date !== today) {
    dailyScans[userId] = { count: 0, date: today };
  }

  if (dailyScans[userId].count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  dailyScans[userId].count++;
  return { allowed: true, remaining: DAILY_LIMIT - dailyScans[userId].count };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Rate limit check
  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Daily scan limit reached (${DAILY_LIMIT}/${DAILY_LIMIT}). Try again tomorrow!` },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { imageBase64, mimeType = "image/jpeg" } = body;

    // Check for demo mode request first (does not require image upload)
    if (body.demo) {
      return NextResponse.json({
        merchant: "Demo Restaurant & Cafe",
        items: [
          { name: "Margherita Pizza (Large)", amount: 450 },
          { name: "Garlic Bread with Cheese", amount: 180 },
          { name: "Cold Coffee / Iced Tea x2", amount: 240 },
          { name: "Chocolate Lava Cake", amount: 160 },
        ],
        tax: 51.50,
        total: 1081.50,
        scansRemaining: rateLimit.remaining,
        isDemo: true,
      });
    }

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { error: "No image data provided" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const groqApiKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey && !groqApiKey && !openRouterApiKey) {
      return NextResponse.json(
        { 
          error: "AI scanning is not configured. Please add GEMINI_API_KEY (free at aistudio.google.com) to your environment variables.",
          demoAvailable: true 
        },
        { status: 533 }
      );
    }

    const prompt = `You are a receipt/bill OCR parser. Analyze this receipt image and extract ALL line items with their prices.

Return ONLY valid JSON in this exact format, no other text:
{
  "merchant": "Name of the restaurant/store or null if unclear",
  "items": [
    { "name": "Item name", "amount": 350 },
    { "name": "Another item", "amount": 120 }
  ],
  "tax": 47,
  "total": 517
}

Rules:
- "amount" must be a number (no currency symbols)
- Include ALL individual line items from the receipt
- "tax" should be the tax/GST/service charge amount, or 0 if not listed
- "total" should be the bill total, or the sum of items + tax if not listed
- If you cannot read an item name clearly, use your best guess
- Do NOT include discount lines as items
- Return ONLY the JSON object, no markdown, no code blocks`;

    let rawText = "";
    let lastErrorText = "";
    let isRateLimited = false;

    // 1. Try Gemini models first (free tier available, best vision support)
    if (apiKey) {
      const modelsToTry = [
        "gemini-3.6-flash",
        "gemini-3.8-flash",
        "gemini-flash-latest",
        "gemini-3.7-flash",
      ];

      for (const model of modelsToTry) {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
        
        try {
          const response = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    {
                      inlineData: {
                        mimeType,
                        data: imageBase64,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 2048,
              },
            }),
          });

          if (response.ok) {
            const geminiData = await response.json();
            rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            break;
          } else {
            lastErrorText = await response.text();
            if (response.status === 429) {
              isRateLimited = true;
            }
            console.error(`Gemini API error with model ${model} (${response.status}):`, lastErrorText);
          }
        } catch (err: any) {
          lastErrorText = err.message || "Network error fetching Gemini API";
          console.error(`Fetch exception with model ${model}:`, err);
        }
      }
    }




    // 3. Try OpenRouter free models if rawText not obtained yet and OPENROUTER_API_KEY exists
    if (!rawText && openRouterApiKey) {
      try {
        const routerRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterApiKey.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "meta-llama/llama-3.2-11b-vision-instruct:free",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${mimeType};base64,${imageBase64}`,
                    },
                  },
                ],
              },
            ],
            temperature: 0.1,
          }),
        });

        if (routerRes.ok) {
          const routerData = await routerRes.json();
          rawText = routerData?.choices?.[0]?.message?.content || "";
        } else {
          lastErrorText = await routerRes.text();
          console.error("OpenRouter API error:", lastErrorText);
        }
      } catch (err: any) {
        console.error("OpenRouter exception:", err);
      }
    }

    if (!rawText) {
      let friendlyError = isRateLimited
        ? "Gemini API Quota Exceeded (429). Google requires billing attached for non-zero Gemini free quota in your region. You can add GROQ_API_KEY to your .env for 100% free scanning without a credit card!"
        : "AI service error. Please check your API key.";
      try {
        const parsedErr = JSON.parse(lastErrorText);
        if (parsedErr?.error?.message) {
          friendlyError = `AI API Error: ${parsedErr.error.message}`;
        }
      } catch {
        if (lastErrorText) {
          friendlyError = `AI API Error: ${lastErrorText.slice(0, 150)}`;
        }
      }

      return NextResponse.json(
        { 
          error: friendlyError, 
          details: lastErrorText,
          demoAvailable: true 
        },
        { status: 502 }
      );
    }

    // Parse JSON from response (handle markdown code blocks)
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse Gemini response:", rawText);
      return NextResponse.json(
        { error: "Could not parse the receipt. Please try a clearer photo or use Demo mode.", demoAvailable: true },
        { status: 422 }
      );
    }

    // Validate structure
    if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      return NextResponse.json(
        { error: "No items found in the receipt. Please try a clearer photo or use Demo mode.", demoAvailable: true },
        { status: 422 }
      );
    }

    // Sanitize items
    const items = parsed.items
      .filter((item: any) => item.name && typeof item.amount === "number" && item.amount > 0)
      .map((item: any) => ({
        name: String(item.name).trim().slice(0, 100),
        amount: Math.round(item.amount * 100) / 100,
      }));

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No valid items could be extracted. Please try a clearer photo or use Demo mode.", demoAvailable: true },
        { status: 422 }
      );
    }

    return NextResponse.json({
      merchant: parsed.merchant || null,
      items,
      tax: typeof parsed.tax === "number" ? Math.round(parsed.tax * 100) / 100 : 0,
      total: typeof parsed.total === "number" ? Math.round(parsed.total * 100) / 100 : 0,
      scansRemaining: rateLimit.remaining,
      isDemo: false,
    });
  } catch (error: any) {
    console.error("Error scanning receipt:", error);
    return NextResponse.json(
      { error: "Failed to scan receipt. Please try again.", demoAvailable: true },
      { status: 500 }
    );
  }
}
