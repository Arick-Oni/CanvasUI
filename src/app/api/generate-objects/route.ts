import { GoogleGenAI, Type } from "@google/genai";
import { DESIGN_SYSTEM } from "@/lib/designSystem";
import { getModelOption } from "@/lib/models";
import { ollamaChat } from "@/lib/ollama";

export const runtime = "nodejs";

// Extend the design-system tokens with explicit layout instructions so the
// model knows to use "rect" for every visual container, not just for text.
const GENERATION_INSTRUCTION = `
${DESIGN_SYSTEM}

---
CANVAS: 1200×800 pixels. You produce a flat array of UIObjects that together
form a complete, visually rich UI. Every element — background, card, navbar,
button, divider, badge — is either a "rect", "text", or "image" object.

OBJECT TYPES — use ONLY these three values for "type":
  "rect"  → every visual box: page background, section fill, card, navbar,
             hero panel, button, badge, input field, avatar circle, divider.
             Set fill (hex color) and radius (px).
  "text"  → every piece of readable copy: headings, body, nav links,
             button labels, captions, tag text.
             Set text, fontSize, fontWeight, textColor.
  "image" → image placeholder boxes only.

LAYERING: z is the draw order (0 = furthest back, higher = in front).
  Background rects: z 0–2.  Section/card rects: z 3–6.  Text on top: z 7+.
  Always give a rect a lower z than the text sitting on top of it.

SIZING: canvas is 1200×800. A full-width background rect spans x:0 y:0
w:1200 h:800. A navbar bar is typically x:0 y:0 w:1200 h:64.

EXAMPLE — a button labeled "Get Started":
  { "id":"btn-bg",  "type":"rect", "role":"cta-background",
    "x":520,"y":380,"width":160,"height":48,
    "fill":"#4f46e5","radius":8,"z":5 }
  { "id":"btn-txt", "type":"text", "role":"cta-label",
    "x":520,"y":392,"width":160,"height":24,
    "text":"Get Started","fontSize":15,"fontWeight":600,
    "textColor":"#ffffff","z":6 }

VISUAL DEPTH — use these fields on rect objects:
  elevation: 0 (flat background), 1 (subtle card shadow), 2 (card/panel),
             3 (floating/modal). Cards always get elevation 1 or 2.
  stroke + strokeWidth: use "#e2e8f0" stroke with strokeWidth 1 for input
  fields, bordered cards, and image placeholders.
  Do NOT give elevation to full-width background rects (z:0).

TYPOGRAPHIC SCALE:
  Page hero headline: fontSize 48, fontWeight 700
  Section heading:    fontSize 32, fontWeight 700
  Card title:         fontSize 20, fontWeight 600
  Body text:          fontSize 16, fontWeight 400
  Caption / label:    fontSize 13, fontWeight 400

REQUIREMENTS for every design:
  • At least one full-width background rect (z:0, fill:#f8fafc or #0f172a).
  • A top navbar rect (z:1, fill:#ffffff or #1e293b, elevation:1 or stroke).
  • Named section containers (hero, features grid, pricing/CTA cards, footer) layered above.
  • Cards get white fill + elevation:2 + radius:12 or 16 + subtle stroke "#e2e8f0".
  • Pill badges/tags (rect fill:#eef2ff radius:999 z:N, text fill:#4f46e5 fontSize:12 fontWeight:600).
  • Buttons: gradient/primary rect fill:#4f46e5 radius:8 z:N, then text on top z:N+1.
  • Text objects always sit on top of their container rect with high contrast textColor.
  • Aim for 35–55 objects so the layout is detailed, balanced, and visually impressive.
  • Use design-system tokens and clean typography scaling.
`.trim();

const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id:          { type: Type.STRING },
      type:        { type: Type.STRING, enum: ["rect", "text", "image"] },
      role:        { type: Type.STRING },
      x:           { type: Type.NUMBER },
      y:           { type: Type.NUMBER },
      width:       { type: Type.NUMBER },
      height:      { type: Type.NUMBER },
      fill:        { type: Type.STRING },
      radius:      { type: Type.NUMBER },
      text:        { type: Type.STRING },
      fontSize:    { type: Type.NUMBER },
      fontWeight:  { type: Type.NUMBER },
      textColor:   { type: Type.STRING },
      z:           { type: Type.NUMBER },
      elevation:   { type: Type.NUMBER },
      stroke:      { type: Type.STRING },
      strokeWidth: { type: Type.NUMBER },
    },
    required: ["id", "type", "role", "x", "y", "width", "height", "z"],
  },
};

// Plain-JSON-Schema mirror of `responseSchema` above, for Ollama's `format` field.
const plainArraySchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      id: { type: "string" },
      type: { type: "string", enum: ["rect", "text", "image"] },
      role: { type: "string" },
      x: { type: "number" },
      y: { type: "number" },
      width: { type: "number" },
      height: { type: "number" },
      fill: { type: "string" },
      radius: { type: "number" },
      text: { type: "string" },
      fontSize: { type: "number" },
      fontWeight: { type: "number" },
      textColor: { type: "string" },
      z: { type: "number" },
      elevation: { type: "number" },
      stroke: { type: "string" },
      strokeWidth: { type: "number" },
    },
    required: ["id", "type", "role", "x", "y", "width", "height", "z"],
  },
};

export async function POST(req: Request) {
  try {
    const { prompt, model: modelId } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return Response.json({ error: "prompt is required" }, { status: 400 });
    }

    const modelOption = getModelOption(modelId);
    const userText =
      `Design this UI on a 1200×800 canvas: ${prompt}\n\n` +
      `Return a JSON array of UIObjects. ` +
      `Every visual container (background, card, navbar, button, section) ` +
      `must be a "rect". Text goes on top. Use z to layer rects below their labels. ` +
      `Make it visually rich — real backgrounds and cards, not just floating text.`;

    let raw: string;
    if (modelOption.provider === "ollama") {
      raw = await ollamaChat({
        model: modelOption.id,
        systemInstruction: GENERATION_INSTRUCTION,
        userText,
        jsonSchema: plainArraySchema,
      });
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: modelOption.id,
        contents: [{ role: "user", parts: [{ text: userText }] }],
        config: {
          systemInstruction: GENERATION_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema,
        },
      });
      raw = response.text ?? "";
    }

    if (!raw) {
      return Response.json({ error: "Empty response from model" }, { status: 500 });
    }

    const objects = JSON.parse(raw);

    // Safety filter: drop any objects with an unrecognised type so they don't
    // silently disappear on the canvas.
    const valid = (objects as { type: string }[]).filter(
      (o) => o.type === "rect" || o.type === "text" || o.type === "image",
    );

    return Response.json({ objects: valid });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
