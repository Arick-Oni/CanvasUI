import { GoogleGenAI } from "@google/genai";
import { chromium } from "playwright";
import { DESIGN_SYSTEM } from "@/lib/designSystem";
import { getModelOption } from "@/lib/models";
import { ollamaChat } from "@/lib/ollama";
import type { UIObject } from "@/lib/types";

import { exportToReact } from "@/lib/exportToHTML";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  DESIGN_SYSTEM +
  "\n---\n" +
  "You are an expert UI/UX frontend engineer and web designer. You are given a UI layout as objects with " +
  "absolute positions and sizes on a 1200×800 canvas, and optionally a screenshot for visual reference. " +
  "These coordinates are the CURRENT, AUTHORITATIVE state of the design. " +
  "Derive section grouping, row/column flow, and component structure from the coordinates. " +
  "Produce visually STUNNING, HIGHLY POLISHED, SEMANTIC, and RESPONSIVE HTML powered by Tailwind CSS. " +
  "CRITICAL DESIGN REQUIREMENTS:\n" +
  "- Include <script src=\"https://cdn.tailwindcss.com\"></script> in <head>.\n" +
  "- Include Google Fonts 'Inter', 'Oswald', 'Montserrat', 'Lato' in <head>.\n" +
  "- Apply Save the Children brand styling: Official Brand Red (#DA291C) for primary CTA buttons, urgency badges, active donation buttons; dark charcoal (#111827) for high-contrast headers; soft card shadows (shadow-lg), subtle 1px border dividers (border-slate-200), and rounded pill buttons.\n" +
  "- Use proper semantic HTML5 tags (<header>, <nav>, <main>, <section>, <article>, <footer>, <button>, <h1>, <h2>, <p>).\n" +
  "- Layout must use modern Flexbox and CSS Grid — NEVER hardcode absolute positions.\n" +
  "- When an image has an 'src' attribute, retain the exact src and alt. For logos, use object-contain.\n" +
  "- Ensure rich contrast, elegant typography spacing, micro-hover interactions (e.g., transition-all hover:scale-[1.02]), and interactive JS for donation amount buttons ($25, $50, $100, $250).\n" +
  "- Output ONE complete, self-contained HTML document (with <!DOCTYPE html>, <html>, <head>, <body>).\n" +
  "- Output ONLY the raw HTML code — no markdown, no code block fences, no explanations.";


function stripFences(text: string): string {
  return text.replace(/^```(?:html)?\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "").trim();
}

// Renders HTML in headless Chromium at 1200×800 and returns a JPEG base64 string.
// Returns null (never throws) so callers can fall back gracefully.
async function renderToJpegBase64(html: string): Promise<string | null> {
  let browser = null;
  try {
    browser = await chromium.launch({ timeout: 15_000 });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 800 });
    // networkidle waits for CDN scripts (Tailwind Play) to load and settle
    await page.setContent(html, { waitUntil: "networkidle", timeout: 25_000 });
    const buf = await page.screenshot({ type: "jpeg", quality: 85 });
    return (buf as Buffer).toString("base64");
  } catch {
    return null;
  } finally {
    try { await browser?.close(); } catch { /* ignore cleanup errors */ }
  }
}

function extractInlineData(dataUrl: string): { mimeType: string; data: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  return m ? { mimeType: m[1], data: m[2] } : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { objects, screenshot, model: modelId } = body as {
      objects: UIObject[];
      screenshot?: string;
      model?: string;
    };

    if (!Array.isArray(objects) || objects.length === 0) {
      return Response.json(
        { error: "objects must be a non-empty array" },
        { status: 400 },
      );
    }

    const modelOption = getModelOption(modelId);
    // Only attempt vision (screenshots) if the selected model supports it AND a
    // screenshot was actually sent (the frontend's screenshot toggle controls this).
    const canUseVision = modelOption.supportsVision && !!screenshot;
    const canvasImg = canUseVision ? extractInlineData(screenshot!) : null;

    let ai: GoogleGenAI | null = null;
    if (modelOption.provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
      }
      ai = new GoogleGenAI({ apiKey });
    }

    // ── Pass 1: generate initial HTML from objects + optional canvas screenshot ──

    const pass1Text =
      `Here are the UI objects from a 1200×800 canvas. Their x/y/width/height reflect the CURRENT ` +
      `design, including any manual repositioning, resizing, or reordering the user has just done — ` +
      `use these exact coordinates as ground truth for layout order, grouping, and alignment:\n\n` +
      `${JSON.stringify(objects, null, 2)}\n\n` +
      `Generate a complete, semantic, responsive HTML page that faithfully represents this exact layout.`;

    let html: string;
    if (modelOption.provider === "ollama") {
      const raw = await ollamaChat({
        model: modelOption.id,
        systemInstruction: SYSTEM_PROMPT,
        userText: pass1Text,
        images: canvasImg ? [canvasImg.data] : undefined,
      });
      html = stripFences(raw);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pass1Parts: any[] = [{ text: pass1Text }];
      if (canvasImg) pass1Parts.push({ inlineData: canvasImg });

      const gen1 = await ai!.models.generateContent({
        model: modelOption.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        contents: [{ role: "user", parts: pass1Parts }] as any,
        config: { systemInstruction: SYSTEM_PROMPT },
      });
      html = stripFences(gen1.text ?? "");
    }

    if (!html) {
      return Response.json({ error: "Empty response from model" }, { status: 500 });
    }

    // ── Pass 2: render → compare → correct (vision-only, best-effort) ─────────
    // Skipped entirely when vision isn't available — there's nothing useful to
    // compare against without a screenshot, and non-vision models can't accept one.

    if (canUseVision) {
      try {
        const renderedBase64 = await renderToJpegBase64(html);

        if (renderedBase64 !== null) {
          const correctionText =
            `Original UI objects (authoritative x/y/width/height — this is ground truth, the ` +
            `screenshots are only for visual/style reference):\n\n${JSON.stringify(objects, null, 2)}\n\n` +
            `Current HTML:\n\`\`\`html\n${html}\n\`\`\`\n\n` +
            "Compare the rendered result to the intended design. Use the original UI objects' coordinates " +
            "— not just the screenshots — to verify element ORDER, ALIGNMENT, and RELATIVE POSITION (which " +
            "elements sit side-by-side vs. stacked, left/right/center alignment, spacing between sections), " +
            "in addition to checking colors, typography, and missing sections from the screenshots. " +
            "The coordinates may reflect a recent manual change by the user, so do not assume the current " +
            "HTML's arrangement was correct just because it renders cleanly — re-verify it against the " +
            "coordinates. Only change structure/order if it actually disagrees with the coordinates; " +
            "if the HTML's arrangement already matches the coordinates, do not restructure it — at most " +
            "fix styling. " +
            "If the structure, order, or positioning differs from the coordinates in any noticeable way, " +
            "return corrected complete HTML. " +
            "If they match well enough, return the HTML unchanged. " +
            "Output only HTML.";

          let corrected: string;
          if (modelOption.provider === "ollama") {
            const raw = await ollamaChat({
              model: modelOption.id,
              systemInstruction: SYSTEM_PROMPT,
              userText:
                "First image is the intended design (canvas screenshot). Second image is the " +
                `rendered HTML screenshot.\n\n${correctionText}`,
              images: [canvasImg!.data, renderedBase64],
            });
            corrected = stripFences(raw);
          } else {
            const gen2 = await ai!.models.generateContent({
              model: modelOption.id,
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: "Intended design (canvas screenshot):" },
                    { inlineData: canvasImg! },
                    { text: "Rendered HTML screenshot:" },
                    { inlineData: { mimeType: "image/jpeg", data: renderedBase64 } },
                    { text: correctionText },
                  ],
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any,
              ],
              config: { systemInstruction: SYSTEM_PROMPT },
            });
            corrected = stripFences(gen2.text ?? "");
          }

          if (corrected) {
            html = corrected;
          }
        }
        // If renderedBase64 is null (Playwright unavailable) we fall through with pass-1 HTML
      } catch {
        // Any error in the correction pass (rate-limit, network, etc.)
        // → silently fall back to the pass-1 result
      }
    }

    return Response.json({ html, reactCode: exportToReact(objects) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
