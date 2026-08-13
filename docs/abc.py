CanvasUI/
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
  package.json
