import fs from 'fs';
import path from 'path';

let assetsData: any[] = [];
let templatesData: any[] = [];
let tokensData: any = {};

try {
  const assetsPath = path.join(process.cwd(), 'scraper/output/stc-assets.json');
  if (fs.existsSync(assetsPath)) {
    assetsData = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));
  }
} catch (err) {
  console.warn('Could not load stc-assets.json', err);
}

try {
  const templatesPath = path.join(process.cwd(), 'scraper/output/stc-templates.json');
  if (fs.existsSync(templatesPath)) {
    templatesData = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
  }
} catch (err) {
  console.warn('Could not load stc-templates.json', err);
}

try {
  const tokensPath = path.join(process.cwd(), 'scraper/output/stc-tokens.json');
  if (fs.existsSync(tokensPath)) {
    tokensData = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  }
} catch (err) {
  console.warn('Could not load stc-tokens.json', err);
}

export type ScrapedAsset = {
  originalUrl?: string;
  localPath?: string;
  publicUrl?: string;
  type: "image" | "logo";
  semanticFilename?: string;
  alt?: string;
  altText?: string;
  tags?: string[];
  width?: number;
  height?: number;
  aspectRatio?: number;
  category?: string;
  description?: string;
  fileName?: string;
};

export type ScrapedTemplate = {
  id: string;
  title: string;
  sectionType: string;
  description: string;
  objects: any[];
};

export function getRelevantAssets(intent: string, type?: 'image' | 'logo', count: number = 5): ScrapedAsset[] {
  const lowerIntent = intent.toLowerCase();
  const keywords = lowerIntent.split(/\s+/).filter(w => w.length > 2);

  let candidates = assetsData;
  if (type) {
    candidates = candidates.filter(a => a.type === type);
  }

  // Score candidates
  const scored = candidates.map(asset => {
    let score = 0;
    const searchableText = `${asset.semanticFilename} ${asset.alt} ${asset.tags?.join(' ') || ''}`.toLowerCase();

    for (const kw of keywords) {
      if (searchableText.includes(kw)) {
        score += 1;
      }
    }

    return { asset, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => s.asset);
}

export function getRelevantTemplates(intent: string, count: number = 2): ScrapedTemplate[] {
  const lowerIntent = intent.toLowerCase();
  const keywords = lowerIntent.split(/\s+/).filter(w => w.length > 2);

  const scored = templatesData.map(template => {
    let score = 0;
    const searchableText = `${template.title} ${template.sectionType} ${template.description}`.toLowerCase();

    for (const kw of keywords) {
      if (searchableText.includes(kw)) {
        score += 1;
      }
    }

    return { template, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => s.template);
}

export function getSTCBrandPrompt(): string {
  const primaryRed = tokensData.colors?.primary?.find((c: any) => c.name === "Primary Red")?.hex || "#DA291C";
  const darkCharcoal = tokensData.colors?.neutrals?.find((c: any) => c.name === "Dark Slate")?.hex || "#111827";
  const brightAccent = "#FFA800"; // fallback

  let prompt = `Save the Children Brand Guidelines:\n`;
  prompt += `- Primary Brand Red: ${primaryRed}\n`;
  prompt += `- Dark Neutrals (text/bg): ${darkCharcoal}\n`;
  prompt += `- Bright Accents: ${brightAccent}\n`;

  const fonts = tokensData.typography?.fonts || ["Lato", "Oswald", "Montserrat"];
  prompt += `- Typography: Use ${fonts.join(', ')} (or clean sans-serif like Inter if unavailable).\n`;
  prompt += `- Buttons: High contrast, usually Primary Red with white text or white with Red text.\n`;
  prompt += `- Style: Trustworthy, urgent yet hopeful. Use trust badges where applicable.\n`;

  return prompt;
}

export function getAllAssets(): ScrapedAsset[] {
    return assetsData;
}

export function getAllTemplates(): ScrapedTemplate[] {
    return templatesData;
}
