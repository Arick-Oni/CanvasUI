"use client";
import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { DesignCanvasHandle, DesignCanvasProps } from "@/components/DesignCanvas";
import type { SelectedObjectProps, UIObject } from "@/lib/types";
import { DEFAULT_MODEL_ID, MODEL_OPTIONS, getModelOption } from "@/lib/models";
import STCDrawer from "@/components/STCDrawer";
import type { ScrapedAsset } from "@/lib/stcRetriever";

const DesignCanvas = dynamic(
  () => import("@/components/DesignCanvas"),
  { ssr: false },
) as ForwardRefExoticComponent<DesignCanvasProps & RefAttributes<DesignCanvasHandle>>;

// ─── Properties panel ──────────────────────────────────────────────────────

const inputCls =
  "h-7 w-full rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 " +
  "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-100";

function PropertiesPanel({
  props: p,
  onUpdate,
  aiEditing,
  aiError,
  onAiEdit,
}: {
  props: SelectedObjectProps;
  onUpdate: (changes: Partial<SelectedObjectProps>) => void;
  aiEditing: boolean;
  aiError: string | null;
  onAiEdit: (instruction: string) => void;
}) {
  const [instruction, setInstruction] = useState("");

  function submitAiEdit() {
    const trimmed = instruction.trim();
    if (!trimmed || aiEditing) return;
    onAiEdit(trimmed);
    setInstruction("");
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Properties
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            p.objectType === "text"
              ? "bg-indigo-50 text-indigo-600"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {p.objectType}
        </span>
      </div>

      {/* W × H */}
      <div className="grid grid-cols-2 gap-2">
        {(["width", "height"] as const).map((key) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">{key === "width" ? "W" : "H"}</span>
            <input
              type="number"
              min={1}
              value={p[key]}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (v > 0) onUpdate({ [key]: v });
              }}
              className={inputCls}
            />
          </label>
        ))}
      </div>

      {/* Rect controls */}
      {p.objectType === "rect" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Fill</span>
            <input
              type="color"
              value={p.fill ?? "#e2e8f0"}
              onChange={(e) => onUpdate({ fill: e.target.value })}
              className="h-7 w-full cursor-pointer rounded border border-slate-300 p-0.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Radius</span>
            <input
              type="number"
              min={0}
              max={500}
              value={p.radius ?? 0}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 0) onUpdate({ radius: v });
              }}
              className={inputCls}
            />
          </label>
        </div>
      )}

      {/* Text controls */}
      {p.objectType === "text" && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Content</span>
            <textarea
              rows={3}
              value={p.text ?? ""}
              onChange={(e) => onUpdate({ text: e.target.value })}
              className={
                "resize-none rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 " +
                "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-100"
              }
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Size</span>
              <input
                type="number"
                min={6}
                max={200}
                value={p.fontSize ?? 14}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (v >= 6) onUpdate({ fontSize: v });
                }}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Weight</span>
              <select
                value={p.fontWeight ?? "400"}
                onChange={(e) => onUpdate({ fontWeight: e.target.value })}
                className={inputCls}
              >
                <option value="400">Regular</option>
                <option value="500">Medium</option>
                <option value="600">SemiBold</option>
                <option value="700">Bold</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Text color</span>
            <input
              type="color"
              value={p.textColor ?? "#0f172a"}
              onChange={(e) => onUpdate({ textColor: e.target.value })}
              className="h-7 w-full cursor-pointer rounded border border-slate-300 p-0.5"
            />
          </label>
        </>
      )}

      {/* ── Edit with AI ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 border-t border-slate-200 pt-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Edit with AI
        </span>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitAiEdit(); }}
            placeholder="e.g. make it larger…"
            disabled={aiEditing}
            className={
              "min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 " +
              "placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 " +
              "focus:ring-indigo-100 disabled:opacity-50"
            }
          />
          <button
            onClick={submitAiEdit}
            disabled={aiEditing || !instruction.trim()}
            className={
              "flex h-7 w-7 shrink-0 items-center justify-center rounded bg-indigo-600 " +
              "text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            }
            title="Edit with AI"
          >
            {aiEditing ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M2 8h12M9 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
        {aiError && (
          <p className="rounded border border-red-100 bg-red-50 px-2 py-1 text-xs text-red-600">
            {aiError}
          </p>
        )}
      </div>
    </div>
  );
}

function ExportModal({
  html,
  reactCode,
  onClose,
}: {
  html: string;
  reactCode?: string;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"html" | "react">("html");
  const [copied, setCopied] = useState(false);

  function downloadHtml() {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "index.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadReact() {
    if (!reactCode) return;
    const blob = new Blob([reactCode], { type: "text/typescript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "SaveTheChildrenAppeal.tsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyCode(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/75 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="text-base font-bold text-slate-900">Export Deliverable</span>
          <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setActiveTab("html")}
              className={`rounded-md px-3.5 py-1 text-xs font-bold transition ${
                activeTab === "html"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🌐 Interactive HTML
            </button>
            <button
              onClick={() => setActiveTab("react")}
              className={`rounded-md px-3.5 py-1 text-xs font-bold transition ${
                activeTab === "react"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              ⚛️ React + Tailwind Component
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === "html" ? (
            <button
              onClick={downloadHtml}
              className="flex items-center gap-1.5 rounded-lg bg-[#DA291C] hover:bg-red-700 px-4 py-2 text-xs font-bold text-white transition shadow"
            >
              <span>⬇️</span> Download index.html
            </button>
          ) : (
            <>
              <button
                onClick={() => copyCode(reactCode || "")}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                {copied ? "✓ Copied!" : "📋 Copy Code"}
              </button>
              <button
                onClick={downloadReact}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white transition shadow"
              >
                <span>⬇️</span> Download .tsx
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-slate-500 transition hover:bg-slate-100"
            title="Close modal"
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === "html" ? (
        <iframe
          srcDoc={html}
          sandbox="allow-scripts allow-modals"
          className="flex-1 border-0 bg-slate-950"
          title="Interactive HTML Export Preview"
        />
      ) : (
        <div className="flex-1 overflow-auto bg-slate-950 p-6 font-mono text-xs text-slate-200">
          <pre className="whitespace-pre-wrap leading-relaxed">{reactCode}</pre>
        </div>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProps, setSelectedProps] = useState<SelectedObjectProps | null>(null);
  const [aiEditing, setAiEditing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportHtml, setExportHtml] = useState<string | null>(null);
  const [exportReact, setExportReact] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [useScreenshot, setUseScreenshot] = useState(true);
  const canvasRef = useRef<DesignCanvasHandle>(null);
  const selectedModel = getModelOption(modelId);

  function handleModelChange(id: string) {
    setModelId(id);
    setUseScreenshot(getModelOption(id).supportsVision);
  }

  // Clear AI error whenever selection changes
  const handleSelectionChange = useCallback((props: SelectedObjectProps | null) => {
    setSelectedProps(props);
    setAiError(null);
  }, []);

  async function handleGenerate() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-objects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model: modelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      canvasRef.current?.renderObjects(data.objects as UIObject[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleUpdate(changes: Partial<SelectedObjectProps>) {
    canvasRef.current?.updateSelected(changes);
    setSelectedProps((prev) => (prev ? { ...prev, ...changes } : prev));
  }

  function handleAddTemplate(objects: any[]) {
    if (!canvasRef.current) return;

    // Assign new IDs and update Z-indexes
    const existingObjects = canvasRef.current.getAllObjects();
    const maxZ = existingObjects.length > 0 ? Math.max(...existingObjects.map(o => o.z ?? 0)) : -1;

    const newObjects = objects.map((obj, i) => ({
      ...obj,
      id: `${obj.id}-${Date.now()}-${i}`,
      z: maxZ + 1 + i,
    }));

    canvasRef.current.renderObjects([...existingObjects, ...newObjects]);
  }

  function handleAddAsset(asset: ScrapedAsset) {
    if (!canvasRef.current) return;

    const existingObjects = canvasRef.current.getAllObjects();
    const maxZ = existingObjects.length > 0 ? Math.max(...existingObjects.map(o => o.z ?? 0)) : -1;

    // Estimate sensible default sizes
    const width = asset.type === 'logo' ? 120 : 400;
    const height = asset.type === 'logo' ? 60 : 300;

    const newObj: UIObject = {
      id: `img-${Date.now()}`,
      type: "image",
      role: asset.type === 'logo' ? "logo" : "featured-photo",
      x: 100, // Default drop position
      y: 100,
      width,
      height,
      src: asset.publicUrl || asset.localPath?.replace('/app/scraper/output/assets', '/assets/stc') || asset.localPath,
      alt: asset.alt || asset.semanticFilename || asset.altText || '',
      z: maxZ + 1,
    };

    canvasRef.current.renderObjects([...existingObjects, newObj]);
  }

  async function handleExport() {
    const objects = canvasRef.current?.getAllObjects() ?? [];
    if (objects.length === 0) {
      setError("Nothing on the canvas to export.");
      return;
    }
    setExporting(true);
    setError(null);
    try {
      const screenshot =
        useScreenshot && selectedModel.supportsVision && canvasRef.current
          ? await canvasRef.current.getCanvasScreenshot()
          : undefined;
      const res = await fetch("/api/export-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objects, screenshot, model: modelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Export failed");
      setExportHtml(data.html as string);
      setExportReact(data.reactCode as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleAiEdit(instruction: string) {
    const currentObj = canvasRef.current?.getSelectedAsUIObject();
    if (!currentObj) return;
    setAiEditing(true);
    setAiError(null);
    try {
      const res = await fetch("/api/edit-object", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ object: currentObj, instruction, model: modelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI edit failed");
      canvasRef.current?.replaceObject(currentObj.id, data.object as UIObject);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI edit failed");
    } finally {
      setAiEditing(false);
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="flex w-[360px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">CanvasUI</h1>
          <p className="mt-1 text-sm text-slate-500">AI-powered UI design</p>
        </div>

        <hr className="border-slate-200" />

        {/* Model selector */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="model" className="text-sm font-medium text-slate-700">
            Model
          </label>
          <select
            id="model"
            value={modelId}
            onChange={(e) => handleModelChange(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <optgroup label="Gemini">
              {MODEL_OPTIONS.filter((m) => m.provider === "gemini").map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </optgroup>
            <optgroup label="Ollama (local)">
              {MODEL_OPTIONS.filter((m) => m.provider === "ollama").map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <hr className="border-slate-200" />

        {/* Generate */}
        <div className="flex flex-col gap-3">
          <label htmlFor="prompt" className="text-sm font-medium text-slate-700">
            Describe your UI
          </label>
          <textarea
            id="prompt"
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. A SaaS landing page with a header, hero, and three feature cards."
            className="resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate"}
          </button>
          {error && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}
        </div>

        {/* Properties + AI edit panel */}
        {selectedProps && (
          <>
            <hr className="border-slate-200" />
            <PropertiesPanel
              props={selectedProps}
              onUpdate={handleUpdate}
              aiEditing={aiEditing}
              aiError={aiError}
              onAiEdit={handleAiEdit}
            />
          </>
        )}

        <div className="flex-1" />

        {/* Footer */}
        <div className="flex flex-col gap-3">
          <label
            className={`flex items-center gap-2 text-xs ${
              selectedModel.supportsVision ? "text-slate-600" : "text-slate-400"
            }`}
          >
            <input
              type="checkbox"
              checked={useScreenshot && selectedModel.supportsVision}
              disabled={!selectedModel.supportsVision}
              onChange={(e) => setUseScreenshot(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 disabled:opacity-50"
            />
            Use canvas screenshot
            {!selectedModel.supportsVision && " (model has no vision support)"}
          </label>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Exporting…
              </span>
            ) : (
              "Export Deliverables"
            )}
          </button>
          <button
            onClick={() => canvasRef.current?.clearCanvas()}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
          >
            Clear canvas
          </button>
          <p className="text-xs text-slate-400">
            Select objects to move, resize, or rotate. Backspace / Delete removes the selection.
          </p>
        </div>
      </aside>

      {/* Canvas work area */}
      <main className="relative flex flex-1 items-center justify-center bg-slate-100">
        {/* Floating Mode Switcher: Edit Canvas vs Live Interactive Preview */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full border border-slate-300/80 bg-white/95 p-1.5 shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={() => setPreviewMode(false)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              !previewMode
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <span>✏️</span> Edit Canvas
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode(true)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              previewMode
                ? "bg-gradient-to-r from-red-600 to-[#DA291C] text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <span>⚡</span> Live Interactive Preview
          </button>
        </div>

        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/70 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-md">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <span className="text-sm font-medium text-slate-700">Generating…</span>
            </div>
          </div>
        )}
        <DesignCanvas ref={canvasRef} previewMode={previewMode} onSelectionChange={handleSelectionChange} />
      </main>

      {/* STC Right Sidebar */}
      <STCDrawer onAddTemplate={handleAddTemplate} onAddAsset={handleAddAsset} />

      {/* Export preview modal */}
      {exportHtml !== null && (
        <ExportModal
          html={exportHtml}
          reactCode={exportReact ?? undefined}
          onClose={() => {
            setExportHtml(null);
            setExportReact(null);
          }}
        />
      )}
    </div>
  );
}
