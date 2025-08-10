import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import Link from 'next/link';

type DetailItem = {
  id: string;
  name: string;
  currentPrice: string;
  lowest30BeforeStart: string | null;
  hasHistory: boolean;
};

type DetailPayload = {
  campaign: {
    id: number;
    name: string;
    status: 'DRAFT' | 'ACTIVE' | 'FINISHED';
    type: string;
    startAt: string;
    endAt: string;
  };
  items: DetailItem[];
};

const fmtMoney = (s?: string | null) =>
  s == null ? '–' : Number(s).toFixed(2);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export default function CampaignDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const resp = await axios.get(`/api/campaigns/${id}/details`);
        setData(resp.data);
      } catch (e: any) {
        console.error('Failed to load campaign details', e?.response?.data || e?.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <div className="max-w-6xl mx-auto p-6 text-gray-600">Loading…</div>;
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <p className="text-red-600">Could not load campaign.</p>
        <Link className="text-indigo-600 underline" href="/campaigns">Back to campaigns</Link>
      </div>
    );
  }

  const c = data.campaign;

  const badge = (s: typeof c.status) => {
    const cls =
      s === 'ACTIVE'
        ? 'bg-green-100 text-green-700'
        : s === 'DRAFT'
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-gray-100 text-gray-700';
    return <span className={`px-2 py-1 rounded text-xs font-medium ${cls}`}>{s}</span>;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{c.name}</h1>
          <div className="text-sm text-gray-600">
            {badge(c.status)} <span className="mx-2">•</span> {c.type} <span className="mx-2">•</span>
            {fmtDate(c.startAt)} → {fmtDate(c.endAt)}
          </div>
        </div>
        <Link href="/campaigns" className="rounded border px-3 py-1.5 hover:bg-gray-50">Back</Link>
      </div>

      <div className="border rounded overflow-hidden bg-white">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-sm text-gray-600">
            <tr>
              <th className="p-3">Product / Variant</th>
              <th className="p-3">Current price</th>
              <th className="p-3">Lowest 30d before start</th>
              <th className="p-3">Compliance data</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-gray-500 break-all">{it.id}</div>
                </td>
                <td className="p-3">€{fmtMoney(it.currentPrice)}</td>
                <td className="p-3">€{fmtMoney(it.lowest30BeforeStart)}</td>
                <td className="p-3">
                  {it.hasHistory ? (
                    <span className="text-green-700 bg-green-50 px-2 py-1 rounded text-xs">History found</span>
                  ) : (
                    <span className="text-amber-700 bg-amber-50 px-2 py-1 rounded text-xs">No history in window</span>
                  )}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr><td colSpan={4} className="p-4 text-gray-500">No products in this campaign.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
