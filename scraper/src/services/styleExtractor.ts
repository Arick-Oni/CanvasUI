import type { ScrapedTokens } from "../types.js";

export type RawStyleEntry = {
  tagName: string;
  role?: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  borderRadius: number;
  boxShadow: string;
};

export class StyleExtractor {
  static rgbToHex(rgbStr: string): string | null {
    if (!rgbStr || rgbStr === "transparent" || rgbStr === "rgba(0, 0, 0, 0)") {
      return null;
    }
    const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) {
      if (rgbStr.startsWith("#")) return rgbStr.toLowerCase();
      return null;
    }
    const r = parseInt(match[1], 10).toString(16).padStart(2, "0");
    const g = parseInt(match[2], 10).toString(16).padStart(2, "0");
    const b = parseInt(match[3], 10).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`.toLowerCase();
  }

  static isRedTone(hex: string): boolean {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // Red dominant
    return r > 160 && g < 80 && b < 80;
  }

  static isDarkNeutral(hex: string): boolean {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return r < 60 && g < 60 && b < 60;
  }

  static isLightSurface(hex: string): boolean {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return r > 230 && g > 230 && b > 230;
  }

  static aggregateTokens(entries: RawStyleEntry[]): ScrapedTokens {
    const redSet = new Set<string>();
    const darkSet = new Set<string>();
    const lightSet = new Set<string>();
    const accentSet = new Set<string>();
    const fontSet = new Set<string>();
    const radiiSet = new Set<number>();
    const shadowSet = new Set<string>();

    const headingMap = new Map<string, { fontSize: number; fontWeight: number; color: string }>();
    const bodyMap = new Map<string, { fontSize: number; fontWeight: number; color: string }>();

    // Add iconic known Save the Children brand colors by default as baselines
    redSet.add("#da291c"); // Official Save the Children red
    redSet.add("#d41b2c");
    darkSet.add("#1a1a1a");
    darkSet.add("#222222");
    lightSet.add("#ffffff");
    lightSet.add("#f7f7f7");

    for (const e of entries) {
      const fg = this.rgbToHex(e.color);
      const bg = this.rgbToHex(e.backgroundColor);
      const border = this.rgbToHex(e.borderColor);

      for (const hex of [fg, bg, border]) {
        if (!hex) continue;
        if (this.isRedTone(hex)) {
          redSet.add(hex);
        } else if (this.isDarkNeutral(hex)) {
          darkSet.add(hex);
        } else if (this.isLightSurface(hex)) {
          lightSet.add(hex);
        } else {
          accentSet.add(hex);
        }
      }

      if (e.fontFamily) {
        const primaryFont = e.fontFamily.split(",")[0].replace(/['"]/g, "").trim();
        if (primaryFont) fontSet.add(primaryFont);
      }

      if (e.borderRadius && e.borderRadius > 0 && e.borderRadius <= 50) {
        radiiSet.add(e.borderRadius);
      }

      if (e.boxShadow && e.boxShadow !== "none") {
        shadowSet.add(e.boxShadow);
      }

      const isHeading = ["h1", "h2", "h3", "h4", "h5", "h6"].includes(e.tagName);
      if (isHeading && fg) {
        const key = `${e.fontSize}-${e.fontWeight}`;
        if (!headingMap.has(key)) {
          headingMap.set(key, { fontSize: e.fontSize, fontWeight: e.fontWeight, color: fg });
        }
      } else if ((e.tagName === "p" || e.tagName === "span") && fg) {
        const key = `${e.fontSize}-${e.fontWeight}`;
        if (!bodyMap.has(key)) {
          bodyMap.set(key, { fontSize: e.fontSize, fontWeight: e.fontWeight, color: fg });
        }
      }
    }

    return {
      colors: {
        primaryRed: Array.from(redSet),
        darkNeutrals: Array.from(darkSet),
        lightSurfaces: Array.from(lightSet),
        accentTones: Array.from(accentSet).slice(0, 10),
      },
      typography: {
        fontFamilies: Array.from(fontSet),
        headings: Array.from(headingMap.values()).sort((a, b) => b.fontSize - a.fontSize),
        bodyText: Array.from(bodyMap.values()).sort((a, b) => b.fontSize - a.fontSize),
      },
      radii: Array.from(radiiSet).sort((a, b) => a - b),
      shadows: Array.from(shadowSet).slice(0, 5),
    };
  }
}
