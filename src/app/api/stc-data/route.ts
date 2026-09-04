import { getAllAssets, getAllTemplates } from "@/lib/stcRetriever";

export const runtime = "nodejs";

export async function GET() {
  try {
    const assets = getAllAssets();
    const templates = getAllTemplates();
    return Response.json({ assets, templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
