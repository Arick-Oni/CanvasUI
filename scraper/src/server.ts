import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { StcCrawler } from "./services/crawler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const outputDir = path.resolve(__dirname, "../output");
const canvasPublicDir = path.resolve(__dirname, "../../public");

app.use(cors());
app.use(express.json());

// Serve scraped assets statically
app.use("/assets", express.static(path.join(outputDir, "assets")));
app.use("/screenshots", express.static(path.join(outputDir, "screenshots")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "stc-design-scraper", timestamp: new Date().toISOString() });
});

app.post("/api/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Valid 'url' is required in request body" });
  }

  try {
    const crawler = new StcCrawler({
      outputDir,
      canvasPublicDir,
      maxImages: 15,
      timeoutMs: 60000,
      headless: true,
    });

    const report = await crawler.scrapeUrl(url);
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/templates", async (_req, res) => {
  try {
    const filePath = path.join(outputDir, "stc-templates.json");
    const content = await fs.readFile(filePath, "utf-8");
    res.json(JSON.parse(content));
  } catch {
    res.status(404).json({ error: "No templates scraped yet. Run /api/scrape or 'npm run scrape' first." });
  }
});

app.get("/api/tokens", async (_req, res) => {
  try {
    const filePath = path.join(outputDir, "stc-tokens.json");
    const content = await fs.readFile(filePath, "utf-8");
    res.json(JSON.parse(content));
  } catch {
    res.status(404).json({ error: "No tokens scraped yet. Run /api/scrape or 'npm run scrape' first." });
  }
});

app.get("/api/assets", async (_req, res) => {
  try {
    const filePath = path.join(outputDir, "stc-assets.json");
    const content = await fs.readFile(filePath, "utf-8");
    res.json(JSON.parse(content));
  } catch {
    res.status(404).json({ error: "No assets scraped yet. Run /api/scrape or 'npm run scrape' first." });
  }
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` STC Scraper Service running on port http://localhost:${PORT}`);
  console.log(` Endpoints:`);
  console.log(`   POST http://localhost:${PORT}/api/scrape`);
  console.log(`   GET  http://localhost:${PORT}/api/templates`);
  console.log(`   GET  http://localhost:${PORT}/api/tokens`);
  console.log(`   GET  http://localhost:${PORT}/api/assets`);
  console.log(`==================================================`);
});
