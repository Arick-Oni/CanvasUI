export const DESIGN_SYSTEM = `
Design System Tokens & Aesthetics Guidelines:
- Typography: Inter font family. Use clear hierarchy (h1: font-extrabold text-4xl/5xl tracking-tight, h2: font-bold text-2xl/3xl, h3: font-semibold text-xl, body: text-slate-600 text-base).
- Background & Canvas: Slate scale — page bg (#0f172a or #f8fafc), glassmorphism cards with backdrop blur, smooth subtle border-slate-200/80 or border-slate-700/50.
- Color Palette:
  • Primary: Indigo-600 (#4f46e5) to Violet-600 (#7c3aed) gradients for hero highlights & primary buttons.
  • Secondary / Accents: Emerald-500 for badges/success, Amber-500 for highlights, Slate-900 for dark surfaces.
  • Surfaces: Pure white (#ffffff) or slate-900 with slate-800 cards.
- Cards & Containers: Rounded-2xl (16px) or rounded-xl (12px), soft box-shadows (shadow-lg shadow-slate-200/50 or shadow-xl), subtle 1px border.
- Buttons & Interactivity: Primary uses gradient (from-indigo-600 to-violet-600 text-white font-medium px-6 py-2.5 rounded-xl shadow-md hover:shadow-indigo-500/20 hover:scale-[1.02] transition-all duration-200). Secondary uses white/slate-100 bg with slate-700 text and subtle border.
- Spacing & Padding: Generous internal card padding (p-6 or p-8), section gaps (gap-6 or gap-8), responsive flex/grid wrappers.
- Badges & Pills: rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60.
- Inputs & Controls: rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all.
`.trim();

