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
    const altText = asset.alt || asset.altText || asset.description || '';
    const filename = asset.semanticFilename || asset.fileName || '';
    const category = asset.category || '';
    const tags = asset.tags?.join(' ') || '';
    const searchableText = `${filename} ${altText} ${category} ${tags}`.toLowerCase();

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

const NOISY_PATTERNS = [
  /welcome to save the children/i,
  /stay on the u\.s\. website/i,
  /international website/i,
  /we can't find the page/i,
  /sorry we can't/i,
  /sign up & stay connected/i,
  /sign in/i,
  /cookie/i,
  /onetrust/i
];

function isCleanObject(obj: any): boolean {
  if (!obj) return false;
  const text = `${obj.text || ''} ${obj.alt || ''} ${obj.role || ''}`;
  for (const pattern of NOISY_PATTERNS) {
    if (pattern.test(text)) return false;
  }
  return true;
}

export function getGenerationAssetKit(intent: string): {
  logos: ScrapedAsset[];
  photos: ScrapedAsset[];
  badges: ScrapedAsset[];
} {
  const brandLogos = assetsData.filter(a =>
    a.type === 'logo' &&
    (a.fileName?.toLowerCase().includes('save_the_children') ||
     a.altText?.toLowerCase().includes('save the children') ||
     a.fileName?.toLowerCase().includes('stc'))
  );

  const trustBadges = assetsData.filter(a =>
    a.type === 'logo' &&
    (a.fileName?.toLowerCase().includes('visa') ||
     a.fileName?.toLowerCase().includes('mastercard') ||
     a.fileName?.toLowerCase().includes('paypal') ||
     a.fileName?.toLowerCase().includes('apple-pay') ||
     a.fileName?.toLowerCase().includes('fundraising'))
  );

  const photos = getRelevantAssets(intent, 'image', 4);

  return {
    logos: brandLogos.length > 0 ? brandLogos.slice(0, 2) : assetsData.filter(a => a.type === 'logo').slice(0, 2),
    photos,
    badges: trustBadges.slice(0, 3),
  };
}

export const CURATED_TEMPLATES: ScrapedTemplate[] = [
  {
    id: "curated-crisis-hero",
    title: "Emergency Crisis Appeal Hero",
    sectionType: "hero",
    description: "Full-bleed crisis appeal with dark gradient, urgent alert badge, headline, and floating donation matrix with payment badges",
    objects: [
      { id: "nav-bg", type: "rect", role: "navbar-bg", x: 0, y: 0, width: 1200, height: 70, fill: "#ffffff", stroke: "#e2e8f0", strokeWidth: 1, z: 10 },
      { id: "nav-logo", type: "image", role: "brand-logo", x: 60, y: 15, width: 180, height: 40, src: "/assets/stc/logos/logo_save_the_children_uk.svg", z: 11 },
      { id: "nav-link1", type: "text", role: "nav-item", x: 300, y: 25, width: 90, height: 24, text: "Emergencies", fontSize: 15, fontWeight: 600, textColor: "#111827", textAlign: "left", z: 11 },
      { id: "nav-link2", type: "text", role: "nav-item", x: 420, y: 25, width: 80, height: 24, text: "What We Do", fontSize: 15, fontWeight: 500, textColor: "#4b5563", textAlign: "left", z: 11 },
      { id: "nav-link3", type: "text", role: "nav-item", x: 530, y: 25, width: 80, height: 24, text: "Stories", fontSize: 15, fontWeight: 500, textColor: "#4b5563", textAlign: "left", z: 11 },
      { id: "nav-cta-btn", type: "rect", role: "cta-button", x: 1020, y: 14, width: 120, height: 42, fill: "#DA291C", radius: 6, z: 11 },
      { id: "nav-cta-txt", type: "text", role: "cta-label", x: 1020, y: 14, width: 120, height: 42, text: "DONATE", fontSize: 14, fontWeight: 700, textColor: "#ffffff", textAlign: "center", z: 12 },

      { id: "hero-photo", type: "image", role: "hero-photo", x: 0, y: 70, width: 1200, height: 490, src: "/assets/stc/images/image_children-walk-down-the-destroyed-streets-of-k.jpg", z: 1 },
      { id: "hero-scrim", type: "rect", role: "overlay-scrim", x: 0, y: 70, width: 1200, height: 490, fill: "rgba(17, 24, 39, 0.72)", z: 2 },

      { id: "urgency-badge-bg", type: "rect", role: "urgency-badge", x: 60, y: 110, width: 190, height: 32, fill: "#DA291C", radius: 4, z: 3 },
      { id: "urgency-badge-txt", type: "text", role: "badge-label", x: 60, y: 110, width: 190, height: 32, text: "URGENT CRISIS APPEAL", fontSize: 12, fontWeight: 700, textColor: "#ffffff", textAlign: "center", z: 4 },

      { id: "hero-h1", type: "text", role: "heading", x: 60, y: 160, width: 620, height: 110, text: "CHILDREN IN CRISIS CANNOT WAIT FOR PEACE", fontSize: 44, fontWeight: 700, textColor: "#ffffff", fontFamily: "'Oswald', sans-serif", z: 3 },
      { id: "hero-sub", type: "text", role: "subheading", x: 60, y: 285, width: 600, height: 75, text: "Over 14 million children in Gaza, Sudan, and Ukraine face severe malnutrition, displacement, and winter freeze. Your emergency support delivers food, thermal blankets, and critical medical care.", fontSize: 16, fontWeight: 400, textColor: "#f1f5f9", fontFamily: "'Lato', sans-serif", z: 3 },

      { id: "card-bg", type: "rect", role: "donation-container", x: 740, y: 95, width: 400, height: 440, fill: "#ffffff", radius: 12, elevation: 3, stroke: "#e2e8f0", strokeWidth: 1, z: 4 },
      { id: "card-title", type: "text", role: "card-heading", x: 770, y: 115, width: 340, height: 30, text: "Make an Emergency Donation", fontSize: 20, fontWeight: 700, textColor: "#111827", textAlign: "left", z: 5 },

      { id: "toggle-bg", type: "rect", role: "pill-toggle", x: 770, y: 155, width: 340, height: 36, fill: "#f1f5f9", radius: 6, z: 5 },
      { id: "toggle-active", type: "rect", role: "toggle-active", x: 772, y: 157, width: 168, height: 32, fill: "#DA291C", radius: 5, z: 6 },
      { id: "toggle-lbl1", type: "text", role: "toggle-text", x: 772, y: 157, width: 168, height: 32, text: "Give Monthly", fontSize: 13, fontWeight: 700, textColor: "#ffffff", textAlign: "center", z: 7 },
      { id: "toggle-lbl2", type: "text", role: "toggle-text", x: 940, y: 157, width: 168, height: 32, text: "Give Once", fontSize: 13, fontWeight: 600, textColor: "#475569", textAlign: "center", z: 7 },

      { id: "amt-1-bg", type: "rect", role: "amount-button", x: 770, y: 205, width: 78, height: 48, fill: "#ffffff", radius: 8, stroke: "#cbd5e1", strokeWidth: 1, z: 5 },
      { id: "amt-1-txt", type: "text", role: "amount-text", x: 770, y: 205, width: 78, height: 48, text: "$25", fontSize: 16, fontWeight: 600, textColor: "#111827", textAlign: "center", z: 6 },

      { id: "amt-2-bg", type: "rect", role: "amount-button-active", x: 857, y: 205, width: 78, height: 48, fill: "#fef2f2", radius: 8, stroke: "#DA291C", strokeWidth: 2, z: 5 },
      { id: "amt-2-txt", type: "text", role: "amount-text", x: 857, y: 205, width: 78, height: 48, text: "$50", fontSize: 16, fontWeight: 700, textColor: "#DA291C", textAlign: "center", z: 6 },

      { id: "amt-3-bg", type: "rect", role: "amount-button", x: 944, y: 205, width: 78, height: 48, fill: "#ffffff", radius: 8, stroke: "#cbd5e1", strokeWidth: 1, z: 5 },
      { id: "amt-3-txt", type: "text", role: "amount-text", x: 944, y: 205, width: 78, height: 48, text: "$100", fontSize: 16, fontWeight: 600, textColor: "#111827", textAlign: "center", z: 6 },

      { id: "amt-4-bg", type: "rect", role: "amount-button", x: 1032, y: 205, width: 78, height: 48, fill: "#ffffff", radius: 8, stroke: "#cbd5e1", strokeWidth: 1, z: 5 },
      { id: "amt-4-txt", type: "text", role: "amount-text", x: 1032, y: 205, width: 78, height: 48, text: "$250", fontSize: 16, fontWeight: 600, textColor: "#111827", textAlign: "center", z: 6 },

      { id: "impact-desc-box", type: "rect", role: "impact-box", x: 770, y: 265, width: 340, height: 50, fill: "#f8fafc", radius: 6, z: 5 },
      { id: "impact-desc-txt", type: "text", role: "impact-text", x: 780, y: 270, width: 320, height: 40, text: "$50 provides emergency therapeutic food to treat 2 severely malnourished children.", fontSize: 13, fontWeight: 500, textColor: "#334155", textAlign: "left", z: 6 },

      { id: "submit-btn", type: "rect", role: "cta-button", x: 770, y: 330, width: 340, height: 50, fill: "#DA291C", radius: 8, elevation: 2, z: 5 },
      { id: "submit-txt", type: "text", role: "cta-label", x: 770, y: 330, width: 340, height: 50, text: "DONATE $50 MONTHLY", fontSize: 16, fontWeight: 700, textColor: "#ffffff", textAlign: "center", z: 6 },

      { id: "trust-label", type: "text", role: "trust-text", x: 770, y: 395, width: 140, height: 24, text: "SECURE PAYMENT", fontSize: 11, fontWeight: 700, textColor: "#64748b", textAlign: "left", z: 5 },
      { id: "badge-visa", type: "image", role: "trust-badge", x: 920, y: 395, width: 44, height: 24, src: "/assets/stc/logos/logo_visa.svg", z: 6 },
      { id: "badge-mc", type: "image", role: "trust-badge", x: 975, y: 395, width: 44, height: 24, src: "/assets/stc/logos/logo_mastercard.svg", z: 6 },
      { id: "badge-paypal", type: "image", role: "trust-badge", x: 1030, y: 395, width: 50, height: 24, src: "/assets/stc/logos/logo_icon---paypal---color-ch11139104.webp", z: 6 },

      { id: "stat-sec-bg", type: "rect", role: "stats-container", x: 0, y: 560, width: 1200, height: 240, fill: "#f8fafc", stroke: "#e2e8f0", strokeWidth: 1, z: 1 },
      { id: "stat1-bg", type: "rect", role: "stat-card", x: 60, y: 590, width: 340, height: 160, fill: "#ffffff", radius: 8, elevation: 1, stroke: "#e2e8f0", strokeWidth: 1, z: 2 },
      { id: "stat1-num", type: "text", role: "stat-number", x: 90, y: 615, width: 280, height: 48, text: "85%", fontSize: 42, fontWeight: 700, textColor: "#DA291C", fontFamily: "'Oswald', sans-serif", z: 3 },
      { id: "stat1-desc", type: "text", role: "stat-label", x: 90, y: 675, width: 280, height: 50, text: "Of every dollar goes directly to mission programs helping children in need.", fontSize: 14, fontWeight: 500, textColor: "#475569", z: 3 },

      { id: "stat2-bg", type: "rect", role: "stat-card", x: 430, y: 590, width: 340, height: 160, fill: "#ffffff", radius: 8, elevation: 1, stroke: "#e2e8f0", strokeWidth: 1, z: 2 },
      { id: "stat2-num", type: "text", role: "stat-number", x: 460, y: 615, width: 280, height: 48, text: "45M+", fontSize: 42, fontWeight: 700, textColor: "#DA291C", fontFamily: "'Oswald', sans-serif", z: 3 },
      { id: "stat2-desc", type: "text", role: "stat-label", x: 460, y: 675, width: 280, height: 50, text: "Children supported across worldwide health, nutrition, and emergency responses.", fontSize: 14, fontWeight: 500, textColor: "#475569", z: 3 },

      { id: "stat3-bg", type: "rect", role: "stat-card", x: 800, y: 590, width: 340, height: 160, fill: "#ffffff", radius: 8, elevation: 1, stroke: "#e2e8f0", strokeWidth: 1, z: 2 },
      { id: "stat3-num", type: "text", role: "stat-number", x: 830, y: 615, width: 280, height: 48, text: "120+", fontSize: 42, fontWeight: 700, textColor: "#DA291C", fontFamily: "'Oswald', sans-serif", z: 3 },
      { id: "stat3-desc", type: "text", role: "stat-label", x: 830, y: 675, width: 280, height: 50, text: "Countries with active Save the Children emergency response teams on the ground.", fontSize: 14, fontWeight: 500, textColor: "#475569", z: 3 },
    ]
  }
];

export function getAllAssets(): ScrapedAsset[] {
  return assetsData;
}

export function getAllTemplates(): ScrapedTemplate[] {
  const cleanScraped = templatesData
    .map(tpl => ({
      ...tpl,
      objects: (tpl.objects || []).filter(isCleanObject)
    }))
    .filter(tpl => tpl.objects.length >= 4);

  return [...CURATED_TEMPLATES, ...cleanScraped];
}
