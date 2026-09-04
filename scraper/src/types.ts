export type UIObject = {
  id: string;
  type: "rect" | "text" | "image";
  role: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  radius?: number;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  textColor?: string;
  z?: number;
  angle?: number;
  elevation?: number;   // 0 none · 1 sm · 2 md · 3 lg
  stroke?: string;      // border color hex
  strokeWidth?: number; // border width px
  src?: string;         // image url or local public asset path
  alt?: string;
};

export type AssetType = "logo" | "image" | "icon" | "svg";

export type ScrapedAsset = {
  id: string;
  type: AssetType;
  remoteUrl: string;
  localPath: string;
  publicUrl: string;
  fileName: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  altText?: string;
  category?: string;
  tags?: string[];
  description?: string;
};

export type SectionType =
  | "navbar"
  | "hero"
  | "donation"
  | "stats"
  | "stories"
  | "footer"
  | "content";

export type ScrapedTemplate = {
  id: string;
  title: string;
  sourceUrl: string;
  sectionType: SectionType;
  description: string;
  bounds: { x: number; y: number; width: number; height: number };
  objects: UIObject[];
  screenshotFile?: string;
};

export type ScrapedTokens = {
  colors: {
    primaryRed: string[];
    darkNeutrals: string[];
    lightSurfaces: string[];
    accentTones: string[];
  };
  typography: {
    fontFamilies: string[];
    headings: { fontSize: number; fontWeight: number; color: string }[];
    bodyText: { fontSize: number; fontWeight: number; color: string }[];
  };
  radii: number[];
  shadows: string[];
};

export type ScrapeReport = {
  url: string;
  timestamp: string;
  title: string;
  assetsCount: number;
  templatesCount: number;
  tokens: ScrapedTokens;
  assets: ScrapedAsset[];
  templates: ScrapedTemplate[];
};
