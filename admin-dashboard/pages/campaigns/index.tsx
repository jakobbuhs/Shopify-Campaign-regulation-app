// admin-dashboard/pages/campaigns/index.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

type CampaignRow = {
  id: number;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'FINISHED';
  startAt: string;
  endAt: string;
  type: string;
  variantsCount: number;
  createdAt: string;
  updatedAt: string;
};

const tabs = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'FINISHED', label: 'Finished' },
] as const;

export default function CampaignsIndex() {
  const [activeTab, setActiveTab] =
    useState<(typeof tabs)[number]['key']>('ALL');
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params =
        activeTab === 'ALL' ? {} : { status: activeTab };
      const resp = await axios.get('/api/campaigns', { params });
      setRows(resp.data.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const badge = (s: CampaignRow['status']) => {
    const cls =
      s === 'ACTIVE'
        ? 'bg-green-100 text-green-700'
        : s === 'DRAFT'
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-gray-100 text-gray-700';
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${cls}`}>
        {s}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <Link
          href="/campaigns/create"
          className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500"
        >
          + New campaign
        </Link>
      </div>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1.5 rounded border ${
              activeTab === t.key
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="border rounded overflow-hidden bg-white">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-sm text-gray-600">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Status</th>
              <th className="p-3">Period</th>
              <th className="p-3">Variants</th>
              <th className="p-3 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="p-4 text-gray-500">
                  Loading…
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-gray-500">
                  No campaigns
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.type}</div>
                  </td>
                  <td className="p-3">{badge(c.status)}</td>
                  <td className="p-3 text-sm">
                    <div>{fmt(c.startAt)} →</div>
                    <div>{fmt(c.endAt)}</div>
                  </td>
                  <td className="p-3">{c.variantsCount}</td>
                  <td className="p-3">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
