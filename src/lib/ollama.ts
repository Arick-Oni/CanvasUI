import { Agent, fetch as undiciFetch } from "undici";

// Node's built-in fetch defaults to a 5-minute headers/body timeout, which
// `stream: false` below blows through on slow/large models since no bytes
// arrive until the whole response is ready. `setGlobalDispatcher` doesn't
// reliably reach Node's built-in fetch (nodejs/undici#1864), so call
// undici's own `fetch` with an explicit per-request dispatcher instead.
const longTimeoutAgent = new Agent({ headersTimeout: 30 * 60 * 1000, bodyTimeout: 30 * 60 * 1000 });

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

  const res = await undiciFetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemInstruction }, userMessage],
      ...(jsonSchema ? { format: jsonSchema } : {}),
      stream: true,
      // Ollama defaults num_ctx to a small window (often 2048-4096) regardless
      // of what the model supports, which silently truncates long structured
      // JSON output mid-object. Force enough room for large designs.
      options: { num_ctx: 16384, num_predict: -1 },
    }),
    dispatcher: longTimeoutAgent,
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed (${res.status}): ${await res.text()}`);
  }
  if (!res.body) {
    throw new Error("Ollama request failed: empty response body");
  }

  // Stream mode sends newline-delimited JSON chunks instead of one buffered
  // response -- this keeps bytes flowing over the tunnel so proxies (e.g.
  // ngrok's free-tier gateway, which kills idle long-running requests after
  // ~5-7 minutes) don't time out a slow model's generation.
  const decoder = new TextDecoder();
  let content = "";
  let buffer = "";
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk as Uint8Array, { stream: true });
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;
      const parsed = JSON.parse(line) as { message?: { content?: string } };
      content += parsed.message?.content ?? "";
    }
  }
  return content;
}
