import { GoogleGenAI, Type } from "@google/genai";
import { getModelOption } from "@/lib/models";
import { ollamaChat } from "@/lib/ollama";
import { getGenerationAssetKit, getRelevantTemplates, CURATED_TEMPLATES } from "@/lib/stcRetriever";

export const runtime = "nodejs";

const GENERATION_INSTRUCTION = `
You are a senior UI/UX designer specializing in Save the Children and world-class NGO web appeals.
You produce a flat JSON array of UIObjects (canvas size: 1200×800 pixels) that forms a complete, visually stunning, production-ready website.

BRAND SYSTEM & TOKENS:
• Primary Red: #DA291C (official Save the Children brand red — use for primary CTA buttons, urgency badges, active donation buttons, and key metrics)
• Dark Charcoal: #111827 (used for text, dark overlays, and headers)
• Slate Gray: #475569 (for secondary/body copy)
• Warm White: #ffffff (cards, navbar)
• Soft Neutral: #f8fafc (backgrounds)
• Border Stroke: #e2e8f0 or #cbd5e1 (cards, inactive buttons)
• Typography:
  - Hero Headlines: fontFamily: "'Oswald', sans-serif", fontSize: 38-46, fontWeight: 700
  - Card & Section Titles: fontFamily: "'Montserrat', sans-serif", fontSize: 20-24, fontWeight: 700
  - Body & Labels: fontFamily: "'Lato', sans-serif", fontSize: 13-16, fontWeight: 400-600

OBJECT TYPES (use ONLY these three values for "type"):
• "rect"  → visual containers: navbar, background, hero scrim, cards, buttons, badges, pill toggles.
            Fields: x, y, width, height, fill (hex/rgba), radius (px), elevation (0-3), stroke, strokeWidth, z.
• "text"  → all copy: headings, body paragraphs, button labels, badge labels, statistics.
            Fields: x, y, width, height, text, fontSize, fontWeight, textColor, textAlign ("left"|"center"|"right"), fontFamily, z.
            CRITICAL RULE FOR BUTTONS & BADGES: Always match the text object's x, y, width, and height to the underlying button rect, and set textAlign: "center" so it is perfectly centered!
• "image" → genuine editorial photos, brand logos, and trust badges.
            Fields: x, y, width, height, role ("hero-photo"|"brand-logo"|"trust-badge"), src (pick from provided authentic assets), alt, z.

CANVAS COMPOSITION BLUEPRINT (Total 1200×800):
1. TOP NAVBAR (y:0 to 70, width:1200):
   - Background rect: x:0, y:0, width:1200, height:70, fill:"#ffffff", stroke:"#e2e8f0", z:10
   - Brand Logo image: x:60, y:15, width:180, height:40, role:"brand-logo", src:Save the Children logo URL, z:11
   - Nav links text: 2-3 links (Emergencies, What We Do, Stories) at x:280-500, y:25, z:11
   - Top Donate button: rect x:1020, y:14, w:120, h:42, fill:"#DA291C", radius:6, z:11
   - Top Donate label: text x:1020, y:14, w:120, h:42, text:"DONATE", textColor:"#ffffff", textAlign:"center", fontWeight:700, z:12

2. FULL-BLEED HERO SECTION (y:70 to 550, width:1200):
   - Hero background photo: image x:0, y:70, w:1200, h:480, role:"hero-photo", src:provided editorial photo URL, z:1
   - Dark Scrim Overlay: rect x:0, y:70, w:1200, h:480, fill:"rgba(17, 24, 39, 0.72)", z:2
   - Urgency Badge: rect x:60, y:110, w:190, h:32, fill:"#DA291C", radius:4, z:3
   - Urgency Badge Text: text x:60, y:110, w:190, h:32, text:"URGENT CRISIS APPEAL", textColor:"#ffffff", textAlign:"center", fontSize:12, fontWeight:700, z:4
   - Hero Headline: text x:60, y:160, w:620, h:110, text:Headline based on prompt, fontSize:42, fontWeight:700, textColor:"#ffffff", fontFamily:"'Oswald', sans-serif", z:3
   - Hero Body Copy: text x:60, y:285, w:600, h:75, text:Compelling description of crisis impact, fontSize:16, textColor:"#f1f5f9", fontFamily:"'Lato', sans-serif", z:3

   - FLOATING DONATION CARD (x:740, y:95, w:400, h:430):
     - Card background: rect x:740, y:95, w:400, h:430, fill:"#ffffff", radius:12, elevation:3, stroke:"#e2e8f0", z:4
     - Card Title: text x:770, y:115, w:340, h:30, text:"Make an Emergency Donation", fontSize:20, fontWeight:700, textColor:"#111827", z:5
     - Frequency Toggle: Monthly / Give Once pill background + active red pill + labels (z:5-7)
     - 4 Amount Buttons ($25, $50, $100, $250): 4 pill rects (w:78, h:48). One active (fill:"#fef2f2", stroke:"#DA291C", strokeWidth:2, textColor:"#DA291C"), others white.
     - Impact Description Box: rect fill:"#f8fafc" + text (e.g. "$50 provides emergency therapeutic food kits for malnourished children.")
     - Submit Button: rect x:770, y:330, w:340, h:50, fill:"#DA291C", radius:8, elevation:2, z:5
     - Submit Label: text x:770, y:330, w:340, h:50, text:"DONATE NOW", textColor:"#ffffff", textAlign:"center", fontSize:16, fontWeight:700, z:6
     - Trust Row: text "SECURE PAYMENT" + 3 trust badge images (Visa, Mastercard, PayPal) at x:920-1080, y:395, z:5-6

3. IMPACT STATS ROW (y:550 to 800, width:1200):
   - Background rect: x:0, y:550, w:1200, h:250, fill:"#f8fafc", z:1
   - 3 Stat Cards (x:60, 430, 800, w:340, h:170):
     - Card rects: fill:"#ffffff", radius:8, elevation:1, stroke:"#e2e8f0", z:2
     - Metric numbers: text fontSize:42, fontWeight:700, textColor:"#DA291C", fontFamily:"'Oswald', sans-serif", z:3 (e.g. "85%", "45M+", "120+")
     - Metric descriptions: text fontSize:14, textColor:"#475569", z:3

Aim for 35–50 well-layered, rich objects. DO NOT invent arbitrary fake image URLs; pick only from the provided list.
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
      textAlign:   { type: Type.STRING, enum: ["left", "center", "right"] },
      fontFamily:  { type: Type.STRING },
      z:           { type: Type.NUMBER },
      elevation:   { type: Type.NUMBER },
      stroke:      { type: Type.STRING },
      strokeWidth: { type: Type.NUMBER },
      src:         { type: Type.STRING },
      alt:         { type: Type.STRING },
    },
    required: ["id", "type", "role", "x", "y", "width", "height", "z"],
  },
};

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
      textAlign: { type: "string", enum: ["left", "center", "right"] },
      fontFamily: { type: "string" },
      z: { type: "number" },
      elevation: { type: "number" },
      stroke: { type: "string" },
      strokeWidth: { type: "number" },
      src: { type: "string" },
      alt: { type: "string" },
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

    // Retrieve full asset kit (logos, contextual photos, trust badges)
    const assetKit = getGenerationAssetKit(prompt);

    let ragContext = `\n\n=== AUTHENTIC SAVE THE CHILDREN ASSETS (Use these exact paths for 'src' in image objects) ===\n`;
    if (assetKit.logos.length > 0) {
      ragContext += `Brand Logos:\n`;
      assetKit.logos.forEach(a => {
        ragContext += `- [logo] URL: ${a.publicUrl || a.localPath} | Alt: ${a.altText || 'Save the Children'}\n`;
      });
    }

    if (assetKit.photos.length > 0) {
      ragContext += `Editorial Photos:\n`;
      assetKit.photos.forEach(a => {
        ragContext += `- [photo] URL: ${a.publicUrl || a.localPath} | Alt: ${a.altText || a.description || 'Editorial Photo'} | Tags: ${a.tags?.join(', ')}\n`;
      });
    }

    if (assetKit.badges.length > 0) {
      ragContext += `Trust & Payment Badges:\n`;
      assetKit.badges.forEach(a => {
        ragContext += `- [trust-badge] URL: ${a.publicUrl || a.localPath} | Alt: ${a.altText || 'Payment Badge'}\n`;
      });
    }

    const curatedSnippet = CURATED_TEMPLATES[0].objects.slice(0, 8);
    ragContext += `\nSTRUCTURAL PATTERN REFERENCE:\n${JSON.stringify(curatedSnippet)}\n`;

    const userText =
      `Design a comprehensive Save the Children appeal on the 1200×800 canvas for: "${prompt}"\n` +
      ragContext +
      `\nGenerate the complete JSON array of UIObjects with 35–50 elements following the Save the Children Brand Blueprint. ` +
      `Ensure button text is perfectly aligned with textAlign: "center" and use the exact authentic asset URLs provided above.`;

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
    const list = Array.isArray(objects) ? objects : objects.objects || [];

    // Filter valid objects
    const valid = list.filter(
      (o: any) => o && (o.type === "rect" || o.type === "text" || o.type === "image")
    );

    return Response.json({ objects: valid });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
