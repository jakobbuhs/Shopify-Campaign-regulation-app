import React, { useEffect, useState } from 'react';
import axios from 'axios';

type Row = { id: string; name: string; price: string };

export default function ProductsExplorer() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchPage(cursor?: string) {
    setLoading(true);
    try {
      const resp = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/products`, {
        params: { q, limit: 25, cursor },
      });
      if (cursor) {
        setRows(prev => [...prev, ...(resp.data.items ?? [])]);
      } else {
        setRows(resp.data.items ?? []);
      }
      setNextCursor(resp.data.nextCursor ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => fetchPage(), 250); // debounce
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Products Explorer</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by product or variant title…"
        className="w-full p-2 border rounded mb-4"
      />
      <div className="border rounded overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2">Variant</th>
              <th className="p-2">Price</th>
              <th className="p-2">ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.name}</td>
                <td className="p-2">€{r.price}</td>
                <td className="p-2 text-xs text-gray-500">{r.id}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={3} className="p-4 text-center text-gray-500">No results</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {loading && <p className="mt-2 text-gray-500">Loading…</p>}
      {nextCursor && !loading && (
        <button
          className="mt-3 px-4 py-2 border rounded"
          onClick={() => fetchPage(nextCursor!)}
        >
          Load more
        </button>
      )}
    </div>
  );
}
