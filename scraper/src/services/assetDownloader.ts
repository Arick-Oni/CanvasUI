import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { ScrapedAsset, AssetType } from "../types.js";

export class AssetDownloader {
  private outputDir: string;
  private canvasPublicDir: string;

  constructor(baseOutputDir: string, canvasPublicDir?: string) {
    this.outputDir = path.resolve(baseOutputDir, "assets");
    this.canvasPublicDir = canvasPublicDir
      ? path.resolve(canvasPublicDir, "assets", "stc")
      : path.resolve(baseOutputDir, "../../public/assets/stc");
  }

  async initDirs(): Promise<void> {
    const subdirs = ["images", "logos", "icons", "svgs"];
    for (const sub of subdirs) {
      await fs.mkdir(path.join(this.outputDir, sub), { recursive: true });
      try {
        await fs.mkdir(path.join(this.canvasPublicDir, sub), { recursive: true });
      } catch {
        // canvas public dir is optional
      }
    }
  }

  static extractTags(text: string): string[] {
    const keywords = [
      "emergency", "flood", "crisis", "hunger", "famine", "gaza", "ukraine", "sudan", "yemen",
      "education", "school", "classroom", "book", "learning", "teacher",
      "health", "midwife", "mother", "baby", "infant", "nutrition", "clinic", "doctor",
      "donation", "donate", "gift", "sponsor", "supplies", "relief", "aid",
      "child", "children", "girl", "boy", "youth", "family", "community", "water",
      "logo", "brand", "icon", "badge", "visa", "paypal", "mastercard", "amex"
    ];
    const lower = text.toLowerCase();
    const found = keywords.filter((k) => lower.includes(k));
    if (found.length === 0) found.push("humanitarian");
    return found;
  }

  private sanitizeFileName(url: string, prefix: string, ext = ".jpg", altText?: string): string {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      const segments = pathname.split("/").filter(Boolean);

      // Check segments for descriptive slug (common in Save the Children DAM URLs)
      for (let i = segments.length - 1; i >= 0; i--) {
        const seg = segments[i].replace(/\.[^/.]+$/, "");
        if (seg.length > 8 && seg.includes("-") && !seg.startsWith("3a0717")) {
          const clean = seg.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 45);
          return `${prefix}_${clean}${ext}`;
        }
      }

      // Check alt text if descriptive
      if (altText && altText.length > 5 && !altText.toLowerCase().includes("image") && !altText.toLowerCase().includes("logo")) {
        const cleanAlt = altText
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .slice(0, 40)
          .replace(/^_+|_+$/g, "");
        if (cleanAlt.length > 4) {
          return `${prefix}_${cleanAlt}${ext}`;
        }
      }

      const base = path.basename(pathname).split("?")[0];
      const cleanBase = base.replace(/[^a-zA-Z0-9._-]/g, "_");
      if (cleanBase && cleanBase.length > 5 && cleanBase.includes(".")) {
        return `${prefix}_${cleanBase}`;
      }
    } catch {
      // fallback
    }
    const hash = crypto.createHash("md5").update(url).digest("hex").slice(0, 10);
    return `${prefix}_${hash}${ext}`;
  }

  async downloadImage(
    remoteUrl: string,
    type: AssetType = "image",
    metadata?: { altText?: string; width?: number; height?: number; category?: string },
    baseUrl?: string
  ): Promise<ScrapedAsset | null> {
    try {
      if (!remoteUrl || remoteUrl.startsWith("data:")) {
        return null;
      }

      let targetUrl = remoteUrl.trim();
      if (targetUrl.startsWith("//")) {
        targetUrl = "https:" + targetUrl;
      } else if (baseUrl && !targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        try {
          targetUrl = new URL(targetUrl, baseUrl).toString();
        } catch {
          // keep as is
        }
      }

      const res = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      });

      if (!res.ok) {
        console.warn(`[AssetDownloader] HTTP status ${res.status} ${res.statusText} for ${targetUrl}`);
        return null;
      }

      const contentType = res.headers.get("content-type") || "";
      let ext = ".jpg";
      if (contentType.includes("png")) ext = ".png";
      else if (contentType.includes("svg")) ext = ".svg";
      else if (contentType.includes("webp")) ext = ".webp";
      else if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = ".jpg";

      const subDir = type === "logo" ? "logos" : type === "icon" ? "icons" : "images";
      const fileName = this.sanitizeFileName(targetUrl, type, ext, metadata?.altText);
      const localFilePath = path.join(this.outputDir, subDir, fileName);

      const buffer = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(localFilePath, buffer);

      // Copy to CanvasUI public dir if available
      try {
        const publicDest = path.join(this.canvasPublicDir, subDir, fileName);
        await fs.writeFile(publicDest, buffer);
      } catch {
        // ignore if CanvasUI public dir doesn't exist yet
      }

      const publicUrl = `/assets/stc/${subDir}/${fileName}`;
      const id = `asset-${crypto.randomBytes(4).toString("hex")}`;
      const tags = AssetDownloader.extractTags(`${fileName} ${targetUrl} ${metadata?.altText || ""}`);
      const cleanDesc =
        metadata?.altText && metadata.altText.length > 5
          ? metadata.altText
          : fileName.replace(/^[a-z]+_/, "").replace(/_/g, " ").replace(/\.[^/.]+$/, "");

      return {
        id,
        type,
        remoteUrl: targetUrl,
        localPath: localFilePath,
        publicUrl,
        fileName,
        width: metadata?.width,
        height: metadata?.height,
        aspectRatio:
          metadata?.width && metadata?.height
            ? Number((metadata.width / metadata.height).toFixed(2))
            : undefined,
        altText: metadata?.altText || "",
        category: metadata?.category || (type === "logo" ? "branding" : tags[0] || "general"),
        tags,
        description: cleanDesc,
      };
    } catch (err) {
      console.warn(`[AssetDownloader] Failed downloading ${remoteUrl}:`, (err as Error).message);
      return null;
    }
  }

  async saveRawSvg(
    svgContent: string,
    name: string,
    type: AssetType = "logo"
  ): Promise<ScrapedAsset | null> {
    try {
      const subDir = type === "logo" ? "logos" : "svgs";
      const fileName = `${name}.svg`;
      const localFilePath = path.join(this.outputDir, subDir, fileName);

      await fs.writeFile(localFilePath, svgContent, "utf-8");

      try {
        const publicDest = path.join(this.canvasPublicDir, subDir, fileName);
        await fs.writeFile(publicDest, svgContent, "utf-8");
      } catch {
        // ignore
      }

      return {
        id: `svg-${crypto.randomBytes(4).toString("hex")}`,
        type,
        remoteUrl: "inline-svg",
        localPath: localFilePath,
        publicUrl: `/assets/stc/${subDir}/${fileName}`,
        fileName,
      };
    } catch {
      return null;
    }
  }
}
