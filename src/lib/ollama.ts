const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";

// Calls a local Ollama model via /api/chat. Pass `jsonSchema` to force
// structured JSON output (Ollama's `format` field accepts a JSON Schema
// object); omit it for free-form text output (e.g. generating HTML).
// `images` must be raw base64 strings with no `data:...;base64,` prefix.
export async function ollamaChat({
  model,
  systemInstruction,
  userText,
  images,
  jsonSchema,
}: {
  model: string;
  systemInstruction: string;
  userText: string;
  images?: string[];
  jsonSchema?: object;
}): Promise<string> {
  const userMessage: Record<string, unknown> = { role: "user", content: userText };
  if (images && images.length > 0) userMessage.images = images;

  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemInstruction }, userMessage],
      ...(jsonSchema ? { format: jsonSchema } : {}),
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.message?.content ?? "";
}
