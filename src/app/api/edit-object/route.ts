import { GoogleGenAI, Type } from "@google/genai";
import { DESIGN_SYSTEM } from "@/lib/designSystem";
import { getModelOption } from "@/lib/models";
import { ollamaChat } from "@/lib/ollama";

export const runtime = "nodejs";

const uiObjectSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    type: { type: Type.STRING },
    role: { type: Type.STRING },
    x: { type: Type.NUMBER },
    y: { type: Type.NUMBER },
    width: { type: Type.NUMBER },
    height: { type: Type.NUMBER },
    fill: { type: Type.STRING },
    radius: { type: Type.NUMBER },
    text: { type: Type.STRING },
    fontSize: { type: Type.NUMBER },
    fontWeight: { type: Type.NUMBER },
    textColor: { type: Type.STRING },
    z: { type: Type.NUMBER },
  },
  required: ["id", "type", "role", "x", "y", "width", "height"],
};

// Plain-JSON-Schema mirror of `uiObjectSchema` above, for Ollama's `format` field.
const plainObjectSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    type: { type: "string" },
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
  },
  required: ["id", "type", "role", "x", "y", "width", "height"],
};

const EDIT_INSTRUCTION =
  DESIGN_SYSTEM +
  "\n---\nYou are editing a single UI object. " +
  "Apply the user's instruction and return ONLY the modified UIObject as JSON, same schema, same id. " +
  "Only change properties the instruction mentions; leave all other properties identical.";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { object, instruction, model: modelId } = body as {
      object: unknown;
      instruction: string;
      model?: string;
    };
    if (!object || !instruction) {
      return Response.json({ error: "object and instruction are required" }, { status: 400 });
    }

    const modelOption = getModelOption(modelId);
    const userText = `Here is one UI object as JSON:\n${JSON.stringify(object, null, 2)}\n\nInstruction: "${instruction}"`;

    let raw: string;
    if (modelOption.provider === "ollama") {
      raw = await ollamaChat({
        model: modelOption.id,
        systemInstruction: EDIT_INSTRUCTION,
        userText,
        jsonSchema: plainObjectSchema,
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
          systemInstruction: EDIT_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: uiObjectSchema,
        },
      });
      raw = response.text ?? "";
    }

    if (!raw) return Response.json({ error: "Empty response from model" }, { status: 500 });
    const editedObject = JSON.parse(raw);
    // Models (especially small local ones) sometimes drop fields they were told to
    // leave unchanged instead of echoing them back — merge over the original so
    // omitted fields fall back to their prior value instead of disappearing.
    const merged = { ...(object as Record<string, unknown>), ...editedObject };
    return Response.json({ object: merged });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
