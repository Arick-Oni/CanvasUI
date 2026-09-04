import { chromium, type Browser, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";
import type { ScrapedAsset, ScrapedTemplate, ScrapeReport } from "../types.js";
import { AssetDownloader } from "./assetDownloader.js";
import { StyleExtractor, type RawStyleEntry } from "./styleExtractor.js";
import { LayoutParser, type RawDomElement } from "./layoutParser.js";

export type CrawlerOptions = {
  outputDir: string;
  canvasPublicDir?: string;
  timeoutMs?: number;
  maxImages?: number;
  headless?: boolean;
};

export class StcCrawler {
  private options: Required<CrawlerOptions>;
  private downloader: AssetDownloader;

  constructor(options: CrawlerOptions) {
    this.options = {
      outputDir: path.resolve(options.outputDir),
      canvasPublicDir: options.canvasPublicDir
        ? path.resolve(options.canvasPublicDir)
        : path.resolve(options.outputDir, "../../public"),
      timeoutMs: options.timeoutMs ?? 45000,
      maxImages: options.maxImages ?? 25,
      headless: options.headless ?? true,
    };
    this.downloader = new AssetDownloader(this.options.outputDir, this.options.canvasPublicDir);
  }

  async init(): Promise<void> {
    await fs.mkdir(this.options.outputDir, { recursive: true });
    await fs.mkdir(path.join(this.options.outputDir, "screenshots"), { recursive: true });
    await this.downloader.initDirs();
  }

  async scrapeUrl(url: string): Promise<ScrapeReport> {
    await this.init();
    console.log(`[StcCrawler] Launching browser to scrape: ${url}`);

    const browser: Browser = await chromium.launch({
      headless: this.options.headless,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const context = await browser.newContext({
        viewport: { width: 1200, height: 800 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      });

      // Shim esbuild's __name helper in browser context
      await context.addInitScript("window.__name = (fn) => fn;");

      const page: Page = await context.newPage();

      console.log(`[StcCrawler] Navigating to ${url}...`);
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.options.timeoutMs });
        // Wait a few seconds for hydration, client-side renders, or dynamic fonts
        await page.waitForTimeout(3000);
      } catch (navErr) {
        console.warn(`[StcCrawler] Initial navigation warning: ${(navErr as Error).message}. Proceeding with loaded DOM.`);
      }
      const pageTitle = (await page.title()) || "Save the Children Page";
      console.log(`[StcCrawler] Page loaded: "${pageTitle}"`);

      // 1. Take viewport screenshot
      try {
        const screenshotFileName = `page_${Date.now()}.jpg`;
        const screenshotPath = path.join(this.options.outputDir, "screenshots", screenshotFileName);
        await page.screenshot({ path: screenshotPath, type: "jpeg", quality: 85 });
      } catch {
        // non-blocking
      }

      // Dismiss & remove all popups, cookie walls, OptinMonster modals, and VWO whiteout layers
      await page.evaluate(() => {
        // Try clicking accept buttons first
        const btns = Array.from(document.querySelectorAll("button, a"));
        for (const btn of btns) {
          const txt = (btn.textContent || "").toLowerCase().trim();
          if (["accept all", "i agree", "accept", "allow all", "close", "reject"].includes(txt)) {
            try { (btn as HTMLElement).click(); } catch {}
          }
        }

        // Safely hide known cookie/consent overlays without removing DOM trees
        const overlaySelectors = [
          "#onetrust-consent-sdk",
          "#onetrust-banner-sdk",
          ".onetrust-pc-dark-filter",
          "#sliding-popup",
          ".eu-cookie-compliance-banner",
          "._vis_hide_layer",
          ".spu-bg",
          ".spu-box",
        ];

        for (const sel of overlaySelectors) {
          try {
            document.querySelectorAll(sel).forEach((el) => {
              (el as HTMLElement).style.display = "none";
              (el as HTMLElement).style.visibility = "hidden";
              (el as HTMLElement).style.pointerEvents = "none";
            });
          } catch {}
        }

        // Restore scrolling safely
        if (document.body) document.body.style.overflow = "auto";
        if (document.documentElement) document.documentElement.style.overflow = "auto";
      });

      // Scroll down thoroughly to trigger Drupal/SCI lazy loading
      await page.evaluate(async () => {
        const bodyHeight = document.body ? document.body.scrollHeight : 2500;
        const totalHeight = Math.min(bodyHeight, 4000);
        for (let y = 0; y <= totalHeight; y += 500) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 200));
        }
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 250));
      });

      // 2. Extract DOM raw data and computed styles in-browser
      const extraction = await page.evaluate(() => {
        try {
          const rawStyles: RawStyleEntry[] = [];
          const rawElements: RawDomElement[] = [];
          const imageCandidates: { url: string; alt?: string; width: number; height: number; isLogo: boolean }[] = [];
          const svgCandidates: { name: string; content: string }[] = [];

        // Helper to extract REAL image URL bypassing Drupal data:image/gif base64 placeholders
        const getRealImageSrc = (el: Element): string => {
          const dataSrc = el.getAttribute("data-src") || el.getAttribute("data-original");
          if (dataSrc && !dataSrc.startsWith("data:")) return dataSrc;

          const dataSrcset = el.getAttribute("data-srcset");
          if (dataSrcset) {
            const candidate = dataSrcset.split(",").pop()?.trim().split(" ")[0];
            if (candidate && !candidate.startsWith("data:")) return candidate;
          }

          const srcset = el.getAttribute("srcset");
          if (srcset) {
            const candidate = srcset.split(",").pop()?.trim().split(" ")[0];
            if (candidate && !candidate.startsWith("data:")) return candidate;
          }

          if (el.tagName.toLowerCase() === "img") {
            const img = el as HTMLImageElement;
            const cur = img.currentSrc;
            if (cur && !cur.startsWith("data:")) return cur;
            const s = img.src;
            if (s && !s.startsWith("data:")) return s;
          }

          // Check parent <picture> element
          const picture = el.closest("picture");
          if (picture) {
            const source = picture.querySelector("source[srcset], source[data-srcset]");
            if (source) {
              const srcVal = source.getAttribute("srcset") || source.getAttribute("data-srcset");
              const cand = srcVal?.split(",").pop()?.trim().split(" ")[0];
              if (cand && !cand.startsWith("data:")) return cand;
            }
          }

          return "";
        }

        // Check logos first (header / svg / brand links)
        const logoElements = document.querySelectorAll(
          "header img, a[href='/'] img, [class*='logo'] img, header picture source, [class*='logo'] source, .logo img"
        );
        for (const el of Array.from(logoElements)) {
          const src = getRealImageSrc(el);
          const alt = el.getAttribute("alt") || "Save the Children Logo";

          if (src && !src.startsWith("data:") && !imageCandidates.some((c) => c.url === src)) {
            imageCandidates.push({
              url: src,
              alt,
              width: 220,
              height: 60,
              isLogo: true,
            });
          }
        }

        // Check for inline header SVGs
        const headerSvgs = document.querySelectorAll("header svg, a[href='/'] svg, [class*='logo'] svg");
        headerSvgs.forEach((svg, idx) => {
          const svgHtml = svg.outerHTML;
          if (svgHtml && svgHtml.length > 60 && svgHtml.length < 60000) {
            svgCandidates.push({ name: `stc_logo_${idx + 1}`, content: svgHtml });
          }
        });

        // Target content elements
        const targets = document.querySelectorAll(
          "header, nav, section, article, h1, h2, h3, h4, p, a, button, img, picture"
        );

        const targetCount = targets.length;
        const bodyLen = document.body ? document.body.innerHTML.length : 0;

        for (const el of Array.from(targets)) {
          const rect = el.getBoundingClientRect();
          // Filter offscreen or invisible elements
          if (rect.width < 5 || rect.height < 5) continue;

          const style = window.getComputedStyle(el);
          const tag = el.tagName.toLowerCase();

          // Collect style tokens
          rawStyles.push({
            tagName: tag,
            color: style.color,
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor,
            fontFamily: style.fontFamily,
            fontSize: parseInt(style.fontSize, 10) || 14,
            fontWeight: parseInt(style.fontWeight, 10) || 400,
            borderRadius: parseInt(style.borderRadius, 10) || 0,
            boxShadow: style.boxShadow,
          });

          // Check for background-image
          if (style.backgroundImage && style.backgroundImage.startsWith("url(")) {
            const match = style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
            if (match && match[1] && !match[1].startsWith("data:")) {
              let bgUrl = match[1];
              if (bgUrl.startsWith("//")) bgUrl = "https:" + bgUrl;
              if (!imageCandidates.some((c) => c.url === bgUrl)) {
                imageCandidates.push({
                  url: bgUrl,
                  alt: "Save the Children hero background photo",
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                  isLogo: false,
                });
              }
            }
          }

          // If image or picture, record for download using real source
          if (tag === "img" || tag === "picture") {
            const realSrc = getRealImageSrc(el);
            if (realSrc && !realSrc.startsWith("data:") && !imageCandidates.some((c) => c.url === realSrc)) {
              const alt = el.getAttribute("alt") || "Save the Children field photography";
              imageCandidates.push({
                url: realSrc,
                alt,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                isLogo: (rect.width < 240 && rect.height < 80) || alt.toLowerCase().includes("logo"),
              });
            }
          }

          // Build raw element representation
          const text = el.textContent?.trim().slice(0, 200) || "";
          rawElements.push({
            tagName: tag,
            role: el.getAttribute("role") || undefined,
            text,
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            fill: style.backgroundColor,
            textColor: style.color,
            fontSize: parseInt(style.fontSize, 10) || 14,
            fontWeight: parseInt(style.fontWeight, 10) || 400,
            borderRadius: parseInt(style.borderRadius, 10) || 0,
            stroke: style.borderColor,
            src: tag === "img" ? ((el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src) : undefined,
            alt: tag === "img" ? (el as HTMLImageElement).alt : undefined,
          });
        }
        return { rawStyles, rawElements, imageCandidates, svgCandidates, targetCount, bodyLen };
      } catch (err: any) {
        return {
          error: String(err?.message || err),
          stack: String(err?.stack || ""),
          rawStyles: [],
          rawElements: [],
          imageCandidates: [],
          svgCandidates: [],
          targetCount: 0,
          bodyLen: 0,
        };
      }
    });

    console.log(`[StcCrawler] DOM targets: ${(extraction as any).targetCount}, body HTML length: ${(extraction as any).bodyLen}`);
    if ((extraction as any).error) {
      console.error(`[StcCrawler] Browser evaluation error: ${(extraction as any).error}`);
      if ((extraction as any).stack) console.error((extraction as any).stack);
    }

      // Save any SVG logos found
      for (const svgItem of extraction.svgCandidates) {
        const svgAsset = await this.downloader.saveRawSvg(svgItem.content, svgItem.name, "logo");
        if (svgAsset) {
          console.log(`[StcCrawler] Saved SVG logo: ${svgItem.name}`);
        }
      }

      console.log(`[StcCrawler] Found ${extraction.imageCandidates.length} images and ${extraction.rawElements.length} elements.`);

      // 3. Download high-value images and logos
      const assets: ScrapedAsset[] = [];
      const imagesToDownload = extraction.imageCandidates.slice(0, this.options.maxImages);

      for (const item of imagesToDownload) {
        const type = item.isLogo ? "logo" : "image";
        console.log(`[StcCrawler] Attempting to download ${type}: ${item.url}`);
        const asset = await this.downloader.downloadImage(
          item.url,
          type,
          {
            altText: item.alt,
            width: item.width,
            height: item.height,
          },
          url
        );
        if (asset) {
          assets.push(asset);
          console.log(`[StcCrawler] Successfully saved: ${asset.fileName}`);
        } else {
          console.log(`[StcCrawler] Failed or skipped: ${item.url}`);
        }
      }

      console.log(`[StcCrawler] Downloaded ${assets.length} visual assets locally.`);

      // 4. Extract design tokens
      const tokens = StyleExtractor.aggregateTokens(extraction.rawStyles);

      // 5. Parse into CanvasUI templates by viewport sections
      const templates: ScrapedTemplate[] = [];

      // Section bands: 0-800px (Hero/Nav), 800-1600px (Donation/Impact), 1600-2400px (Stories/Features)
      const bands = [
        { name: "Header & Hero Appeal", yStart: 0, yEnd: 800 },
        { name: "Donation & Impact Section", yStart: 800, yEnd: 1600 },
        { name: "Stories & Community Action", yStart: 1600, yEnd: 2400 },
      ];

      for (const band of bands) {
        const bandElements = extraction.rawElements.filter(
          (e) => e.y >= band.yStart && e.y < band.yEnd && (e.text || e.tagName === "img" || (e.fill && e.fill !== "transparent"))
        );

        if (bandElements.length >= 4) {
          const sectionType = LayoutParser.classifySection(bandElements);
          const template = LayoutParser.createTemplateFromElements(
            `Save the Children ${band.name}`,
            url,
            sectionType,
            bandElements,
            { x: 0, y: band.yStart, width: 1200, height: 800 }
          );
          templates.push(template);
        }
      }

      const report: ScrapeReport = {
        url,
        timestamp: new Date().toISOString(),
        title: pageTitle,
        assetsCount: assets.length,
        templatesCount: templates.length,
        tokens,
        assets,
        templates,
      };

      // 6. Save JSON files to disk (Cumulative merge)
      const tokensFile = path.join(this.options.outputDir, "stc-tokens.json");
      const templatesFile = path.join(this.options.outputDir, "stc-templates.json");
      const assetsFile = path.join(this.options.outputDir, "stc-assets.json");

      // Merge tokens
      let mergedTokens = tokens;
      try {
        const existingTokensRaw = await fs.readFile(tokensFile, "utf-8");
        const prevTokens = JSON.parse(existingTokensRaw) as typeof tokens;
        mergedTokens = {
          colors: {
            primaryRed: Array.from(new Set([...prevTokens.colors.primaryRed, ...tokens.colors.primaryRed])),
            darkNeutrals: Array.from(new Set([...prevTokens.colors.darkNeutrals, ...tokens.colors.darkNeutrals])),
            lightSurfaces: Array.from(new Set([...prevTokens.colors.lightSurfaces, ...tokens.colors.lightSurfaces])),
            accentTones: Array.from(new Set([...prevTokens.colors.accentTones, ...tokens.colors.accentTones])),
          },
          typography: {
            fontFamilies: Array.from(new Set([...prevTokens.typography.fontFamilies, ...tokens.typography.fontFamilies])),
            headings: [...prevTokens.typography.headings, ...tokens.typography.headings].slice(0, 15),
            bodyText: [...prevTokens.typography.bodyText, ...tokens.typography.bodyText].slice(0, 15),
          },
          radii: Array.from(new Set([...prevTokens.radii, ...tokens.radii])),
          shadows: Array.from(new Set([...prevTokens.shadows, ...tokens.shadows])),
        };
      } catch {
        // no existing tokens
      }

      // Merge templates
      let mergedTemplates = templates;
      try {
        const existingTplRaw = await fs.readFile(templatesFile, "utf-8");
        const prevTemplates = JSON.parse(existingTplRaw) as ScrapedTemplate[];
        // Filter out templates from the same source URL to avoid duplicates on re-scrape
        const filteredPrev = prevTemplates.filter((t) => t.sourceUrl !== url);
        mergedTemplates = [...filteredPrev, ...templates];
      } catch {
        // no existing templates
      }

      // Merge assets
      let mergedAssets = assets;
      try {
        const existingAssetsRaw = await fs.readFile(assetsFile, "utf-8");
        const prevAssets = JSON.parse(existingAssetsRaw) as ScrapedAsset[];
        const assetMap = new Map<string, ScrapedAsset>();
        for (const a of [...prevAssets, ...assets]) {
          assetMap.set(a.remoteUrl, a);
        }
        mergedAssets = Array.from(assetMap.values());
      } catch {
        // no existing assets
      }

      await fs.writeFile(tokensFile, JSON.stringify(mergedTokens, null, 2), "utf-8");
      await fs.writeFile(templatesFile, JSON.stringify(mergedTemplates, null, 2), "utf-8");
      await fs.writeFile(assetsFile, JSON.stringify(mergedAssets, null, 2), "utf-8");
      await fs.writeFile(
        path.join(this.options.outputDir, "scrape-report.json"),
        JSON.stringify(report, null, 2),
        "utf-8"
      );

      console.log(`[StcCrawler] Scraping completed! Cumulative Library: ${mergedTemplates.length} templates, ${mergedAssets.length} assets.`);
      return report;
    } finally {
      await browser.close();
    }
  }
}
