import React, { useState, useEffect } from 'react';
import type { ScrapedAsset, ScrapedTemplate } from '@/lib/stcRetriever';

type Props = {
  onAddTemplate: (objects: any[]) => void;
  onAddAsset: (asset: ScrapedAsset) => void;
};

export default function STCDrawer({ onAddTemplate, onAddAsset }: Props) {
  const [activeTab, setActiveTab] = useState<'templates' | 'assets'>('templates');
  const [templates, setTemplates] = useState<ScrapedTemplate[]>([]);
  const [assets, setAssets] = useState<ScrapedAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all templates and assets
    fetch('/api/stc-data')
      .then(res => res.json())
      .then(data => {
        setTemplates(data.templates || []);
        setAssets(data.assets || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load STC data:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
     return <div className="p-4 text-sm text-slate-500">Loading STC Library...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 w-80 shrink-0 shadow-sm overflow-hidden z-10">
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Save the Children Library</h2>
      </div>

      <div className="flex border-b border-slate-200">
        <button
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'templates' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}
          onClick={() => setActiveTab('templates')}
        >
          Templates
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'assets' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}
          onClick={() => setActiveTab('assets')}
        >
          Assets
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
        {activeTab === 'templates' && (
          <div className="flex flex-col gap-3">
            {templates.map(tpl => (
              <div
                key={tpl.id}
                className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:border-indigo-500 cursor-pointer transition-colors"
                onClick={() => onAddTemplate(tpl.objects)}
              >
                <h3 className="text-sm font-semibold text-slate-900">{tpl.title}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{tpl.description}</p>
                <div className="mt-2 text-[10px] uppercase font-bold text-slate-400">{tpl.sectionType}</div>
              </div>
            ))}
            {templates.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No templates found.</p>}
          </div>
        )}

        {activeTab === 'assets' && (
          <div className="grid grid-cols-2 gap-3">
            {assets.map((asset, i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-lg p-2 shadow-sm flex flex-col items-center justify-center hover:border-indigo-500 cursor-pointer transition-colors group relative"
                onClick={() => onAddAsset(asset)}
                title={asset.alt || asset.semanticFilename}
              >
                {/* Fixed height container for uniform grid */}
                <div className="h-24 w-full flex items-center justify-center overflow-hidden">
                   <img
                     src={asset.publicUrl || asset.localPath?.replace('/app/scraper/output/assets', '/assets/stc') || asset.localPath}
                     alt={asset.alt || asset.semanticFilename || asset.altText || ''}
                     className={`max-h-full max-w-full ${asset.type === 'logo' ? 'object-contain' : 'object-cover w-full h-full'}`}
                   />
                </div>
                <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none" />
              </div>
            ))}
            {assets.length === 0 && <p className="text-sm text-slate-500 text-center py-4 col-span-2">No assets found.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
