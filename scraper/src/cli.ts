import path from "node:path";
import { fileURLToPath } from "node:url";
import { StcCrawler } from "./services/crawler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_TARGETS = [
  "https://www.savethechildren.net/",
  "https://www.savethechildren.net/what-we-do/emergencies",
  "https://www.savethechildren.net/our-impact",
  "https://www.savethechildren.org.uk/",
  "https://www.savethechildren.org.uk/how-you-can-help/emergencies/gaza-emergency-appeal",
  "https://www.savethechildren.org.uk/what-we-do/emergency-response",
  "https://www.savethechildren.org/",
  "https://www.savethechildren.org/us/what-we-do/emergency-response",
  "https://www.savethechildren.org.au/",
];

async function main() {
  const args = process.argv.slice(2);
  let targetUrls: string[] = [];

  const urlFlagIdx = args.indexOf("--url");
  if (urlFlagIdx !== -1 && args[urlFlagIdx + 1]) {
    targetUrls = [args[urlFlagIdx + 1]];
  } else {
    targetUrls = DEFAULT_TARGETS;
  }

  const outputDir = path.resolve(__dirname, "../output");
  const canvasPublicDir = path.resolve(__dirname, "../../public");

  console.log("==================================================");
  console.log(" Save the Children Design & Asset Scraper (Multi-Site)");
  console.log("==================================================");
  console.log(`Target URLs (${targetUrls.length}):\n  - ${targetUrls.join("\n  - ")}`);
  console.log(`Output Directory: ${outputDir}`);
  console.log(`CanvasUI Public Asset Sync: ${canvasPublicDir}`);
  console.log("--------------------------------------------------");

  const crawler = new StcCrawler({
    outputDir,
    canvasPublicDir,
    maxImages: 25,
    timeoutMs: 60000,
    headless: true,
  });

  for (const url of targetUrls) {
    try {
      console.log(`\n>>> Starting scrape for: ${url}`);
      const report = await crawler.scrapeUrl(url);
      console.log(`✓ Completed: ${report.title}`);
      console.log(`  - Assets downloaded: ${report.assetsCount}`);
      console.log(`  - Templates parsed: ${report.templatesCount}`);
      console.log(`  - Primary Red tones found: ${report.tokens.colors.primaryRed.join(", ")}`);
      console.log(`  - Headings recorded: ${report.tokens.typography.headings.length}`);
    } catch (err) {
      console.error(`✗ Error scraping ${url}:`, (err as Error).message);
    }
  }

  console.log("\n==================================================");
  console.log("All scraping jobs finished.");
  console.log(`Data & assets available in: ${outputDir}`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Fatal crawler error:", err);
  process.exit(1);
});
