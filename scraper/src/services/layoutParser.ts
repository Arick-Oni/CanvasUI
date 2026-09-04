import type { UIObject, ScrapedTemplate, SectionType } from "../types.js";
import crypto from "node:crypto";

export type RawDomElement = {
  tagName: string;
  role?: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: number;
  borderRadius?: number;
  stroke?: string;
  src?: string;
  alt?: string;
  className?: string;
};

export class LayoutParser {
  private static generateId(prefix: string): string {
    return `${prefix}-${crypto.randomBytes(3).toString("hex")}`;
  }

  /**
   * Identifies section type based on content, keywords, and element characteristics
   */
  static classifySection(elements: RawDomElement[]): SectionType {
    const combinedText = elements.map((e) => e.text.toLowerCase()).join(" ");
    const hasImage = elements.some((e) => e.tagName === "img" && e.width > 200);

    if (
      combinedText.includes("donate") ||
      combinedText.includes("$") ||
      combinedText.includes("monthly") ||
      combinedText.includes("gift")
    ) {
      return "donation";
    }
    if (
      (combinedText.includes("million") || combinedText.includes("%") || combinedText.includes("countries")) &&
      elements.some((e) => (e.fontSize ?? 0) >= 28)
    ) {
      return "stats";
    }
    if (
      combinedText.includes("emergency") ||
      combinedText.includes("crisis") ||
      combinedText.includes("appeal") ||
      (hasImage && elements.some((e) => (e.fontSize ?? 0) >= 36))
    ) {
      return "hero";
    }
    if (combinedText.includes("story") || combinedText.includes("read more") || combinedText.includes("news")) {
      return "stories";
    }
    if (elements.some((e) => e.y < 90 && e.width > 800)) {
      return "navbar";
    }
    return "content";
  }

  /**
   * Normalizes elements into a CanvasUI-compatible 1200x800 coordinate space
   */
  static createTemplateFromElements(
    title: string,
    sourceUrl: string,
    sectionType: SectionType,
    elements: RawDomElement[],
    bounds: { x: number; y: number; width: number; height: number }
  ): ScrapedTemplate {
    const objects: UIObject[] = [];
    const offsetX = bounds.x;
    const offsetY = bounds.y;

    // 1. Add section container background rect if appropriate
    const sectionBgId = this.generateId("sec-bg");
    objects.push({
      id: sectionBgId,
      type: "rect",
      role: `${sectionType}-container`,
      x: 0,
      y: 0,
      width: 1200,
      height: Math.min(800, Math.max(300, bounds.height)),
      fill: sectionType === "hero" ? "#1a1a1a" : "#ffffff",
      radius: 0,
      z: 0,
    });

    let currentZ = 1;

    // Filter out tiny or zero-size elements
    const validElements = elements.filter(
      (el) => el.width >= 12 && el.height >= 10 && el.text !== "" || el.tagName === "img" || el.fill
    );

    for (const el of validElements) {
      // Relative coordinates
      const relX = Math.max(0, Math.min(1180, Math.round(el.x - offsetX)));
      const relY = Math.max(0, Math.min(780, Math.round(el.y - offsetY)));
      const w = Math.min(1200 - relX, Math.round(el.width));
      const h = Math.min(800 - relY, Math.round(el.height));

      if (w <= 0 || h <= 0) continue;

      if (el.tagName === "img") {
        objects.push({
          id: this.generateId("img"),
          type: "image",
          role: el.width < 160 ? "logo" : "featured-photo",
          x: relX,
          y: relY,
          width: w,
          height: h,
          radius: el.borderRadius ?? 8,
          src: el.src,
          alt: el.alt || "Save the Children visual",
          z: currentZ++,
        });
      } else if (["button", "a"].includes(el.tagName) || el.role === "button") {
        // Container button rect + text
        const isDonateCta = el.text.toLowerCase().includes("donate");
        const btnBgId = this.generateId("btn-bg");
        objects.push({
          id: btnBgId,
          type: "rect",
          role: "button-background",
          x: relX,
          y: relY,
          width: w,
          height: h,
          fill: isDonateCta ? "#da291c" : (el.fill || "#da291c"),
          radius: el.borderRadius ?? 6,
          elevation: isDonateCta ? 2 : 1,
          z: currentZ++,
        });

        if (el.text) {
          objects.push({
            id: this.generateId("btn-text"),
            type: "text",
            role: "button-label",
            x: relX,
            y: relY + Math.max(4, Math.round((h - (el.fontSize ?? 14)) / 2) - 2),
            width: w,
            height: Math.min(h, 24),
            text: el.text,
            fontSize: el.fontSize || 15,
            fontWeight: el.fontWeight || 700,
            textColor: el.textColor || "#ffffff",
            z: currentZ++,
          });
        }
      } else if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "span"].includes(el.tagName)) {
        if (el.text && el.text.trim().length > 0) {
          objects.push({
            id: this.generateId("txt"),
            type: "text",
            role: el.tagName.startsWith("h") ? "heading" : "body",
            x: relX,
            y: relY,
            width: w,
            height: h,
            text: el.text.trim(),
            fontSize: el.fontSize || (el.tagName === "h1" ? 36 : el.tagName === "h2" ? 28 : 15),
            fontWeight: el.fontWeight || (el.tagName.startsWith("h") ? 700 : 400),
            textColor: el.textColor || (sectionType === "hero" ? "#ffffff" : "#1a1a1a"),
            z: currentZ++,
          });
        }
      } else if (el.fill && el.fill !== "transparent" && el.fill !== "rgba(0, 0, 0, 0)") {
        // Visual container box or card
        objects.push({
          id: this.generateId("card"),
          type: "rect",
          role: "content-box",
          x: relX,
          y: relY,
          width: w,
          height: h,
          fill: el.fill,
          radius: el.borderRadius ?? 8,
          stroke: el.stroke,
          elevation: 1,
          z: currentZ++,
        });
      }
    }

    return {
      id: `tpl-${crypto.randomBytes(4).toString("hex")}`,
      title,
      sourceUrl,
      sectionType,
      description: `Save the Children ${sectionType} component extracted from ${new URL(sourceUrl).hostname}`,
      bounds,
      objects: objects.slice(0, 60), // Keep clean within UIObject limit
    };
  }
}
