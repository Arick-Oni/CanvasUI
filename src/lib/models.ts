export type ModelProvider = "gemini" | "ollama";

export type ModelOption = {
  id: string;
  label: string;
  provider: ModelProvider;
  supportsVision: boolean;
};

// Edit this list to add/remove models from the selector. Ollama models must
// already be pulled locally (`ollama pull <id>`) and `ollama serve` running.
export const MODEL_OPTIONS: ModelOption[] = [
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", provider: "gemini", supportsVision: true },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini", supportsVision: true },
  { id: "qwen2.5vl:7b", label: "Qwen2.5-VL 7B (Ollama)", provider: "ollama", supportsVision: true },
  { id: "qwen2.5-coder:14b", label: "Qwen2.5 Coder 14B (Ollama)", provider: "ollama", supportsVision: false },
  { id: "qwen3.6:27b", label: "Qwen3.6 27B (Ollama)", provider: "ollama", supportsVision: true },
];

export const DEFAULT_MODEL_ID = "gemini-3.1-flash-lite";

export function getModelOption(id: string | undefined | null): ModelOption {
  return (
    MODEL_OPTIONS.find((m) => m.id === id) ??
    MODEL_OPTIONS.find((m) => m.id === DEFAULT_MODEL_ID) ??
    MODEL_OPTIONS[0]
  );
}
