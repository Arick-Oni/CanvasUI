# -*- coding: utf-8 -*-
"""One-off generator for CanvasUI_Technical_Documentation.docx. Not part of the app."""
import os
import tempfile
from docx import Document
from docx.shared import Pt, Inches, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from PIL import Image, ImageDraw, ImageFont

OUT_PATH = os.path.join(os.path.dirname(__file__), "CanvasUI_Technical_Documentation.docx")
TMP_DIR = tempfile.mkdtemp(prefix="canvasui_doc_")

ACCENT = RGBColor(0x4F, 0x46, 0xE5)
SLATE = RGBColor(0x33, 0x41, 0x55)
MUTED = RGBColor(0x64, 0x74, 0x8B)
PLACEHOLDER_COLOR = RGBColor(0x94, 0x74, 0x10)

doc = Document()

# ── base style tweaks ────────────────────────────────────────────────────
normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(10.5)

for i in range(1, 4):
    h = doc.styles[f"Heading {i}"]
    h.font.color.rgb = ACCENT if i == 1 else SLATE
    h.font.name = "Calibri"


def add_placeholder_image(doc, width_px=1000, height_px=560, title="SCREENSHOT PLACEHOLDER", subtitle=""):
    img = Image.new("RGB", (width_px, height_px), (245, 247, 250))
    draw = ImageDraw.Draw(img)
    dash, gap = 14, 10
    x0, y0, x1, y1 = 6, 6, width_px - 6, height_px - 6
    for x in range(x0, x1, dash + gap):
        draw.line([(x, y0), (min(x + dash, x1), y0)], fill=(148, 163, 184), width=3)
        draw.line([(x, y1), (min(x + dash, x1), y1)], fill=(148, 163, 184), width=3)
    for y in range(y0, y1, dash + gap):
        draw.line([(x0, y), (x0, min(y + dash, y1))], fill=(148, 163, 184), width=3)
        draw.line([(x1, y), (x1, min(y + dash, y1))], fill=(148, 163, 184), width=3)
    try:
        font_title = ImageFont.truetype("arialbd.ttf", 34)
        font_sub = ImageFont.truetype("arial.ttf", 22)
    except Exception:
        font_title = ImageFont.load_default(size=34)
        font_sub = ImageFont.load_default(size=22)
    tw = draw.textlength(title, font=font_title)
    draw.text(((width_px - tw) / 2, height_px / 2 - 40), title, fill=(100, 116, 139), font=font_title)
    if subtitle:
        sw = draw.textlength(subtitle, font=font_sub)
        draw.text(((width_px - sw) / 2, height_px / 2 + 10), subtitle, fill=(148, 163, 184), font=font_sub)
    path = os.path.join(TMP_DIR, f"ph_{abs(hash((title, subtitle)))}.png")
    img.save(path)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(path, width=Inches(5.8))


def add_caption(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    run.italic = True
    run.font.size = Pt(9)
    run.font.color.rgb = MUTED


def add_placeholder_line(doc, label, hint="Click here and type your findings."):
    p = doc.add_paragraph()
    r1 = p.add_run(f"{label}: ")
    r1.bold = True
    r2 = p.add_run(hint)
    r2.italic = True
    r2.font.color.rgb = PLACEHOLDER_COLOR


def shade_cell(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), hex_color)
    tcPr.append(shd)


def add_table(doc, headers, rows, widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Light Grid Accent 1"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr_cells = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = ""
        run = hdr_cells[i].paragraphs[0].add_run(h)
        run.bold = True
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        shade_cell(hdr_cells[i], "4F46E5")
    for row in rows:
        cells = table.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = str(val)
    if widths:
        for row in table.rows:
            for i, w in enumerate(widths):
                row.cells[i].width = Inches(w)
    return table


def page_break(doc):
    doc.add_page_break()


# ── Title page ───────────────────────────────────────────────────────────
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = title.add_run("CanvasUI")
run.font.size = Pt(40)
run.bold = True
run.font.color.rgb = ACCENT
doc.add_paragraph().alignment = WD_ALIGN_PARAGRAPH.CENTER

sub = doc.add_paragraph()
sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = sub.add_run("Technical Documentation & Model Testing Report")
r.font.size = Pt(18)
r.font.color.rgb = SLATE

sub2 = doc.add_paragraph()
sub2.alignment = WD_ALIGN_PARAGRAPH.CENTER
r2 = sub2.add_run("AI-Powered UI Design Tool — Canvas-Based Generation, Editing & HTML Export")
r2.italic = True
r2.font.color.rgb = MUTED

for _ in range(6):
    doc.add_paragraph()

meta = doc.add_paragraph()
meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_placeholder_line(doc, "Prepared by", "<Add your name>")
add_placeholder_line(doc, "Date", "<Add report date>")
add_placeholder_line(doc, "Project Repository", "CanvasUI (Next.js)")

page_break(doc)

# ── 1. Overview ──────────────────────────────────────────────────────────
doc.add_heading("1. Overview", level=1)
doc.add_paragraph(
    "CanvasUI is an AI-powered UI design tool. A user describes a desired interface in plain "
    "English; the app asks a large language model to translate that description into a structured "
    "array of typed canvas objects (rectangles, text, image placeholders), renders that layout on an "
    "interactive Fabric.js canvas, and lets the user refine it manually or via natural-language "
    "AI-assisted edits on individual elements. The finished design can be exported as a single "
    "self-contained, responsive HTML document."
)
doc.add_paragraph(
    "The application supports two interchangeable AI backends, selectable per-request from the UI: "
    "Google Gemini (cloud-hosted) and Ollama (self-hosted open-weight models, run either locally or "
    "on a remotely tunnelled GPU instance such as Google Colab or Kaggle)."
)

doc.add_heading("1.1 Core Capabilities", level=2)
for item in [
    "Text-to-design generation: natural language prompt -> full canvas layout (30-50 objects)",
    "Direct manual editing: drag, resize, rotate, recolor, retype via the canvas and properties panel",
    "AI-assisted single-object editing: natural language instruction applied to one selected object",
    "HTML export: layout -> complete, semantic, responsive HTML page (Tailwind CSS), with an optional "
    "vision-based render -> compare -> correct verification pass",
    "Pluggable model provider: swap between Gemini and Ollama (local or remote) per request",
]:
    doc.add_paragraph(item, style="List Bullet")

# ── 2. Tech stack ────────────────────────────────────────────────────────
doc.add_heading("2. Technology Stack", level=1)
add_table(
    doc,
    ["Layer", "Technology", "Purpose"],
    [
        ("Framework", "Next.js 16 (App Router)", "Frontend + server-side API routes, single deployable app"),
        ("UI", "React 19, Tailwind CSS 4", "Sidebar, properties panel, modals"),
        ("Canvas engine", "Fabric.js 6", "Interactive object rendering, selection, transform, screenshot capture"),
        ("Cloud AI SDK", "@google/genai", "Gemini model calls with JSON-schema-constrained output"),
        ("Local/self-hosted AI", "Ollama", "Runs open-weight models (Qwen2.5-VL, Qwen2.5-Coder, Qwen3.6)"),
        ("HTTP client", "undici", "Explicit long-timeout, streaming-capable fetch for Ollama calls"),
        ("Headless rendering", "Playwright (Chromium)", "Server-side screenshot of generated HTML for vision-based self-correction"),
        ("Language", "TypeScript", "End-to-end static typing"),
    ],
    widths=[1.3, 1.8, 3.3],
)

page_break(doc)

# ── 3. Architecture ──────────────────────────────────────────────────────
doc.add_heading("3. System Architecture", level=1)

doc.add_heading("3.1 Frontend", level=2)
add_table(
    doc,
    ["File", "Responsibility"],
    [
        ("src/app/page.tsx", "Top-level page: sidebar (model selector, prompt box, properties panel, "
                              "export/clear actions), loading states, HTML preview modal, and the three "
                              "client-side handlers that call the API routes."),
        ("src/components/DesignCanvas.tsx", "Fabric.js canvas wrapper. Exposes an imperative handle "
                              "(renderObjects, updateSelected, getSelectedAsUIObject, replaceObject, "
                              "getAllObjects, getCanvasScreenshot) so the page component never touches "
                              "Fabric APIs directly."),
        ("src/lib/types.ts", "Shared UIObject and SelectedObjectProps type definitions."),
        ("src/lib/exportToHTML.ts", "Deterministic objects-to-HTML serializer (absolute-position div/p "
                              "markup). Present in the codebase as a non-AI fallback path but not "
                              "currently wired into any route -- /api/export-html uses AI generation "
                              "instead (see 3.2)."),
    ],
    widths=[2.3, 4.1],
)

doc.add_heading("3.2 Backend API Routes", level=2)
doc.add_paragraph(
    "All three routes are Next.js Route Handlers running on the Node.js runtime "
    "(export const runtime = \"nodejs\"), each delegating to either the Gemini SDK or "
    "ollamaChat() depending on the selected model's provider."
)
add_table(
    doc,
    ["Route", "Input -> Output", "Notes"],
    [
        ("POST /api/generate-objects", "{ prompt, model } -> { objects: UIObject[] }",
         "Single generation pass. System prompt combines the design-system tokens with detailed "
         "layout/typography/z-order rules; output constrained to a JSON array via Gemini responseSchema "
         "or Ollama format."),
        ("POST /api/edit-object", "{ object, instruction, model } -> { object: UIObject }",
         "Edits exactly one object. Result is merged over the original object so any fields a (smaller) "
         "model omits fall back to their previous value instead of disappearing."),
        ("POST /api/export-html", "{ objects, screenshot?, model } -> { html }",
         "Two-pass for vision-capable models: pass 1 generates HTML from the objects (+ screenshot); "
         "pass 2 renders that HTML headlessly via Playwright, compares it against the original canvas "
         "screenshot, and asks the model to correct structural/positional mismatches. Non-vision models "
         "and requests without a screenshot skip pass 2 entirely."),
    ],
    widths=[1.8, 2.1, 2.5],
)

doc.add_heading("3.3 Data Model — UIObject", level=2)
add_table(
    doc,
    ["Field", "Type", "Meaning"],
    [
        ("id", "string", "Stable identifier, referenced by replaceObject/edit-object"),
        ("type", "\"rect\" | \"text\" | \"image\"", "Drives which Fabric primitive is created"),
        ("role", "string", "Semantic role (e.g. \"navbar\", \"cta-background\") used for HTML tag inference"),
        ("x, y, width, height", "number", "Absolute position/size on the 1200x800 canvas"),
        ("z", "number", "Draw order; higher draws on top"),
        ("fill, radius", "string / number", "Rect fill colour and corner radius"),
        ("text, fontSize, fontWeight, textColor", "mixed", "Text-object styling"),
        ("elevation", "0-3", "Maps to a shadow preset (none/sm/md/lg)"),
        ("stroke, strokeWidth", "string / number", "Optional border"),
        ("angle", "number", "Rotation in degrees, preserved on export"),
    ],
    widths=[2.0, 1.8, 2.6],
)

page_break(doc)

# ── 4. AI Provider Layer ────────────────────────────────────────────────
doc.add_heading("4. AI Model Provider Layer", level=1)

doc.add_heading("4.1 Provider Abstraction (src/lib/models.ts)", level=2)
doc.add_paragraph(
    "A single MODEL_OPTIONS array is the source of truth for every selectable model: its id "
    "(the literal model identifier sent to the provider), a UI label, its provider "
    "(\"gemini\" | \"ollama\"), and whether it supports image input. getModelOption() resolves an "
    "id with a safe fallback to DEFAULT_MODEL_ID, then MODEL_OPTIONS[0], so an unknown or missing "
    "model id can never crash a request."
)

doc.add_heading("4.2 Gemini Provider", level=2)
doc.add_paragraph(
    "Called directly via the @google/genai SDK using GEMINI_API_KEY from the environment. Structured "
    "output is enforced with responseMimeType: \"application/json\" plus an explicit responseSchema "
    "(Gemini's typed Type.OBJECT/Type.ARRAY schema format). Vision requests attach the canvas "
    "screenshot as inlineData alongside the text prompt."
)

doc.add_heading("4.3 Ollama Provider (src/lib/ollama.ts)", level=2)
doc.add_paragraph(
    "Calls a self-hosted Ollama instance's /api/chat endpoint (OLLAMA_HOST env var, default "
    "http://localhost:11434). Because this project also runs Ollama remotely behind a public tunnel "
    "(see Section 5), this client needed several deliberate hardening measures beyond a plain fetch() "
    "call, found and fixed during testing:"
)
add_table(
    doc,
    ["Mechanism", "Why it's necessary"],
    [
        ("Streaming responses (stream: true), manually reassembled from newline-delimited JSON chunks",
         "A buffered (stream: false) call sends zero bytes until generation is fully complete. Over a "
         "public tunnel this idle period is exactly what gets killed by gateway timeouts (see 5.4); "
         "streaming keeps bytes flowing continuously instead."),
        ("Explicit per-request undici.Agent dispatcher with a 30-minute headersTimeout/bodyTimeout",
         "Node's built-in fetch defaults to a 5-minute timeout. Calling undici.setGlobalDispatcher() "
         "does not reliably reach Node's built-in fetch implementation (a known undici limitation), so "
         "the dispatcher is passed directly into each fetch call instead."),
        ("Explicit options.num_ctx (16384) and num_predict (-1) on every request",
         "Ollama's default context window (often 2048-4096 tokens) is independent of what the "
         "underlying model architecturally supports, and silently truncates long structured JSON output "
         "mid-object once exceeded -- producing a JSON syntax error on parse rather than an obvious "
         "error message."),
    ],
    widths=[2.6, 3.8],
)

page_break(doc)

# ── 5. Remote hosting ───────────────────────────────────────────────────
doc.add_heading("5. Remote Model Hosting Infrastructure", level=1)
doc.add_paragraph(
    "Larger Ollama models (7B-27B+ parameters) exceed what's practical to run on typical local laptop "
    "hardware. To test them, Ollama is instead run on a free cloud GPU notebook and exposed back to "
    "this app over a public tunnel."
)

doc.add_heading("5.1 Google Colab Setup", level=2)
doc.add_paragraph(
    "colab/run_ollama_colab.ipynb automates the full setup on a free Colab GPU runtime (T4, 16GB VRAM):"
)
for item in [
    "Installs the zstd system package (required by Ollama's installer but missing from the base Colab image), then installs Ollama",
    "Stops/disables Ollama's auto-started systemd service, frees port 11434, and starts ollama serve "
    "manually with OLLAMA_ORIGINS=* (without this, Ollama returns 403 Forbidden for any request whose "
    "Host header isn't localhost -- which every tunnelled request is)",
    "Pulls each Ollama model configured in models.ts",
    "Opens a public HTTPS tunnel to port 11434 via pyngrok and prints the URL to paste into .env.local as OLLAMA_HOST",
]:
    doc.add_paragraph(item, style="List Bullet")

doc.add_heading("5.2 Kaggle as an Alternative", level=2)
doc.add_paragraph(
    "Kaggle Notebooks offer the same free, notebook-based approach with one practical advantage: its "
    "free GPU quota (30 hrs/week) includes a \"T4 x2\" option -- two T4 GPUs, 32GB combined VRAM. "
    "Ollama automatically splits a model's layers across multiple GPUs, so a model like qwen3.6:27b "
    "(~17GB) fits entirely in VRAM instead of partially offloading to CPU, avoiding a significant "
    "inference slowdown. Setup is otherwise identical, with the \"Internet\" toggle in notebook "
    "settings needing to be enabled for pip install / the ngrok tunnel to work."
)

doc.add_heading("5.3 Known Operational Issues & Resolutions", level=2)
doc.add_paragraph(
    "The following issues were encountered and resolved during hands-on testing of the remote-hosting "
    "setup, in the order they surfaced:"
)
add_table(
    doc,
    ["Symptom", "Root Cause", "Resolution"],
    [
        ("Ollama installer fails: \"requires zstd for extraction\"", "Base Colab image is missing the zstd package",
         "apt-get install -y zstd before running the Ollama install script"),
        ("403 Forbidden on every tunnelled request", "Ollama rejects requests whose Host header isn't "
         "localhost/127.0.0.1 by default", "Start ollama serve with OLLAMA_ORIGINS=*"),
        ("403 persisted after the fix", "Ollama's installer also registers a systemd service that "
         "silently re-occupies port 11434 on its own (unfixed) configuration",
         "Explicitly stop/disable the systemd service and free the port before starting ollama serve manually"),
        ("ERR_NGROK_8012 (\"connection refused\")", "ollama serve was no longer running, while the ngrok "
         "tunnel process was technically still alive", "Restart the Colab runtime and re-run all setup cells"),
        ("ERR_NGROK_3200 (\"endpoint is offline\")", "The Colab session itself disconnected (idle timeout "
         "or ~12h hard cap)", "Restart runtime, re-run all cells, update OLLAMA_HOST with the new tunnel URL"),
        ("ERR_NGROK_3004 (\"endpoint offline\") while Colab looked unchanged", "Free ngrok tunnel "
         "sessions expire on their own schedule, independent of the Colab kernel", "Re-run only the ngrok "
         "tunnel cell to open a fresh session"),
        ("Request fails after exactly 5 minutes (\"fetch failed\")", "Node's built-in fetch defaults to a "
         "5-minute headers/body timeout; a buffered (non-streaming) Ollama call sends no bytes until done",
         "Custom undici Agent with a 30-minute timeout, passed as a per-request dispatcher"),
        ("Still fails at ~5-7 minutes via 503 / ERR_NGROK_3004, even with the longer client-side timeout",
         "ngrok's free-tier gateway independently kills long-running idle HTTP requests, regardless of "
         "client timeout settings", "Switched the Ollama call to stream: true so bytes flow continuously"),
        ("Frontend shows a JSON parse error (\"Expected ',' or '}' ... \") after a long generation",
         "Ollama's default context window (num_ctx) truncated the structured JSON output before the "
         "model could close the array", "Explicit options.num_ctx: 16384, num_predict: -1 on every request"),
    ],
    widths=[2.1, 2.3, 2.0],
)

page_break(doc)

# ── 6. Models table ──────────────────────────────────────────────────────
doc.add_heading("6. Configured Models Reference", level=1)
doc.add_paragraph("Source of truth: src/lib/models.ts. Selectable from the Model dropdown in the sidebar.")
add_table(
    doc,
    ["Label", "Model ID", "Provider", "Vision Support", "Hosting"],
    [
        ("Gemini 3.1 Flash Lite", "gemini-3.1-flash-lite", "Gemini", "Yes", "Cloud (default model)"),
        ("Gemini 2.5 Flash", "gemini-2.5-flash", "Gemini", "Yes", "Cloud"),
        ("Qwen2.5-VL 7B (Ollama)", "qwen2.5vl:7b", "Ollama", "Yes", "Local / Colab / Kaggle"),
        ("Qwen2.5 Coder 14B (Ollama)", "qwen2.5-coder:14b", "Ollama", "No", "Local / Colab / Kaggle"),
        ("Qwen3.6 27B (Ollama)", "qwen3.6:27b", "Ollama", "Yes", "Colab (T4) / Kaggle (T4x2 recommended)"),
    ],
    widths=[1.7, 1.6, 0.9, 1.0, 1.9],
)

page_break(doc)

# ── 7. Testing screenshots ───────────────────────────────────────────────
doc.add_heading("7. Testing Documentation", level=1)
doc.add_paragraph(
    "Replace each placeholder image below with an actual screenshot captured during testing "
    "(right-click the image in Word -> Change Picture -> This Device)."
)

test_sections = [
    ("Design Generation", "Prompt -> generated canvas layout (/api/generate-objects)"),
    ("Manual Canvas Editing", "Selecting, moving, resizing, recolouring an object via the properties panel"),
    ("AI-Assisted Object Edit", "Natural-language instruction applied to a single selected object"),
    ("HTML Export & Preview", "Exported HTML rendered in the in-app preview modal (/api/export-html)"),
    ("Remote Hosting Setup", "Colab / Kaggle notebook running ollama serve with an active ngrok tunnel"),
]
for heading, desc in test_sections:
    doc.add_heading(heading, level=2)
    add_placeholder_image(doc, title="SCREENSHOT PLACEHOLDER", subtitle=desc)
    add_caption(doc, desc)
    add_placeholder_line(doc, "Observations", "<Add notes about this test here>")
    doc.add_paragraph()

page_break(doc)

# ── 8. Per-model evaluation reports ─────────────────────────────────────
doc.add_heading("8. Per-Model Evaluation Reports", level=1)
doc.add_paragraph(
    "One section per configured model. Fill in each subsection after running your own tests; fields "
    "are left blank intentionally."
)

models_for_report = [
    "Gemini 3.1 Flash Lite (gemini-3.1-flash-lite)",
    "Gemini 2.5 Flash (gemini-2.5-flash)",
    "Qwen2.5-VL 7B (qwen2.5vl:7b, Ollama)",
    "Qwen2.5 Coder 14B (qwen2.5-coder:14b, Ollama)",
    "Qwen3.6 27B (qwen3.6:27b, Ollama)",
]

for idx, model_name in enumerate(models_for_report, start=1):
    doc.add_heading(f"8.{idx} {model_name}", level=2)
    add_placeholder_line(doc, "Test Date")
    add_placeholder_line(doc, "Hosting Used", "<Local / Colab / Kaggle / Cloud>")
    add_placeholder_line(doc, "Prompts Tested", "<List the prompts/instructions you tried>")
    add_placeholder_line(doc, "Average Generation Time", "<e.g. 12s, 4 min, 10 min>")
    add_placeholder_line(doc, "Output Quality — Layout Accuracy", "<Your assessment>")
    add_placeholder_line(doc, "Output Quality — Visual Fidelity", "<Your assessment>")
    add_placeholder_line(doc, "JSON Validity / Errors Encountered", "<Any truncation, malformed output, etc.>")
    doc.add_heading("Screenshot", level=3)
    add_placeholder_image(doc, title="SCREENSHOT PLACEHOLDER", subtitle=model_name)
    add_placeholder_line(doc, "Notes / Conclusion", "<Overall verdict on this model for this app>")
    doc.add_paragraph()

page_break(doc)

# ── 9. Appendix ───────────────────────────────────────────────────────────
doc.add_heading("9. Appendix A — Project File Structure", level=1)
tree = """CanvasUI/
  colab/
    run_ollama_colab.ipynb      Colab setup notebook (Ollama + ngrok tunnel)
  docs/
    CanvasUI_Technical_Documentation.docx
  src/
    app/
      page.tsx                  Main page: sidebar, canvas area, state/handlers
      layout.tsx                Root layout, fonts
      api/
        generate-objects/route.ts   Prompt -> UIObject[] design generation
        edit-object/route.ts        Single-object AI edit
        export-html/route.ts        UIObject[] -> standalone HTML (+ vision correction pass)
    components/
      DesignCanvas.tsx           Fabric.js canvas wrapper (imperative handle)
    lib/
      types.ts                   UIObject / SelectedObjectProps types
      models.ts                  Model provider registry
      ollama.ts                  Hardened Ollama HTTP client (streaming, timeouts, context window)
      designSystem.ts            Shared design-token text injected into every AI system prompt
      exportToHTML.ts            Deterministic HTML serializer (not currently wired into a route)
  .env.local                     GEMINI_API_KEY, GEMINI_MODEL, OLLAMA_HOST
  package.json"""
p = doc.add_paragraph()
run = p.add_run(tree)
run.font.name = "Consolas"
run.font.size = Pt(9)

doc.add_heading("9. Appendix B — Environment Variables", level=1)
add_table(
    doc,
    ["Variable", "Purpose"],
    [
        ("GEMINI_API_KEY", "API key for Google Gemini requests"),
        ("GEMINI_MODEL", "Default Gemini model identifier (informational; per-request model id comes from the UI selector)"),
        ("OLLAMA_HOST", "Base URL of the Ollama server -- http://localhost:11434 for a local instance, or a "
         "public ngrok URL when using a remotely hosted Colab/Kaggle instance"),
    ],
    widths=[1.8, 4.6],
)

doc.save(OUT_PATH)
print("Saved:", OUT_PATH)
