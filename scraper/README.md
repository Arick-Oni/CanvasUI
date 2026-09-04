# Save the Children Design & Asset Scraper

A standalone crawler and layout extractor for Save the Children websites. It extracts:
1. **Visual Assets**: High-resolution photography, logos, and icons, automatically synchronized to CanvasUI's `/public/assets/stc/`.
2. **Design Tokens**: Brand red (`#DA291C`), dark neutrals, typography hierarchy, border radii, and button styles.
3. **UI Templates**: Parsed layout sections (Hero Appeals, Donation Cards, Impact Statistics, Story Grids) converted directly to CanvasUI's `UIObject[]` schema for instant canvas rendering.

---

## Installation

```bash
cd scraper
npm install
npx playwright install chromium
```

---

## Usage

### 1. CLI Scraper

Scrape the default Save the Children target sites (`savethechildren.org` & `savethechildren.org.uk`):
```bash
npm run scrape
```

Scrape a specific URL:
```bash
npm run scrape -- --url "https://www.savethechildren.org/us/what-we-do/emergency-response"
```

### 2. REST API Server

Start the local background service:
```bash
npm run server
```

The server listens on `http://localhost:4000` with the following endpoints:
* `GET  /api/health`: Health status.
* `POST /api/scrape`: Trigger a scrape with body `{ "url": "https://..." }`.
* `GET  /api/templates`: Fetch all parsed `UIObject[]` templates.
* `GET  /api/tokens`: Fetch extracted brand colors and typography.
* `GET  /api/assets`: List all downloaded images and logos.

---

## Output Structure

```
scraper/output/
├── assets/
│   ├── images/       # High-res child & humanitarian photography
│   ├── logos/        # Brand logos & SVGs
│   └── icons/        # Badges and UI icons
├── screenshots/      # Viewport and section screenshots
├── stc-tokens.json   # Brand colors, typography, radii
├── stc-templates.json# UIObject[] layout templates for CanvasUI
├── stc-assets.json   # Catalog of downloaded assets
└── scrape-report.json# Summary report of the last scrape
```
