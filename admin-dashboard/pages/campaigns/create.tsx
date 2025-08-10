import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/router'

type Variant = { id: string; name: string; price: string }

export default function CreateCampaign() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', startAt: '', endAt: '', value: '' })
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Variant[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([]);
  const [override30d, setOverride30d] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');


  // select handling
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggle = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  // debounced, cancelable search
  useEffect(() => {
    const controller = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const resp = await axios.get('/api/products', { params: { q: search, limit: 25 }, signal: controller.signal as any })
        setProducts(resp.data.items ?? [])
        setNextCursor(resp.data.nextCursor ?? null)
      } catch (e: any) {
        if (e.name !== 'CanceledError' && e.code !== 'ERR_CANCELED') {
          console.error('Search error', e)
        }
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      controller.abort()
      clearTimeout(t)
    }
  }, [search])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  
    // Convert datetime-local to ISO (backend expects real ISO times)
    const startISO = new Date(form.startAt).toISOString();
    const endISO   = new Date(form.endAt).toISOString();
  
    setErrors([]);
    try {
      setErrors([]);
      await axios.post('/api/campaigns/create', {
        name: form.name,
        type: 'SALE',
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        variantIds: Array.from(selected),
        discountLogic: { type: 'percentage', value: Number(form.value) },
        override30d,
        overrideReason: override30d ? overrideReason : undefined,
      });
      router.push('/campaigns');
    } catch (err: any) {
      if (err.response?.status === 422) {
        const v = err.response.data?.violations ?? [];
        setErrors(
          v.map((x: any) =>
            `${x.variantId}: ${x.message}${x.minPriceLast30 != null ? ` (30d low: ${x.minPriceLast30})` : ''}`
          )
        );
      } else {
        setErrors([err.response?.data?.error || err.message || 'Failed to create campaign']);
      }
    }
    
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold">New Campaign</h1>

      <input
        type="text"
        placeholder="Search products…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-2 border rounded mb-2 focus:outline-indigo-500"
      />
      <div className="text-sm text-gray-500 mb-2">
        {loading ? 'Searching…' : `${products.length} result${products.length === 1 ? '' : 's'}`}
      </div>

      <div className="max-h-64 overflow-y-auto border p-2 rounded">
        {!loading && products.map(p => (
          <label key={p.id} className="flex items-center space-x-2 mb-2 hover:bg-gray-50 p-1 rounded">
            <input
              type="checkbox"
              checked={selected.has(p.id)}
              onChange={() => toggle(p.id)}
              className="h-4 w-4"
            />
            <span className="text-gray-800">{p.name} • ${p.price}</span>
          </label>
        ))}
        {!loading && products.length === 0 && (
          <p className="text-gray-500 text-center">No products match “{search}”</p>
        )}
        {errors.length > 0 && (
      <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <div className="font-medium mb-1">Compliance check failed:</div>
        <ul className="list-disc pl-5 space-y-1">
          {errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      </div>
    )}
              </div>

      {nextCursor && (
        <button
          type="button"
          onClick={async () => {
            const resp = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/products`, {
              params: { q: search, limit: 25, cursor: nextCursor },
            })
            setProducts(prev => [...prev, ...(resp.data.items ?? [])])
            setNextCursor(resp.data.nextCursor ?? null)
          }}
          className="mt-2 w-full py-2 border rounded"
        >
          Load more
        </button>
      )}
      

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="name"
          placeholder="Campaign Name"
          value={form.name}
          onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
          className="w-full p-3 border rounded focus:outline-indigo-500"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            name="startAt"
            type="datetime-local"
            value={form.startAt}
            onChange={e => setForm(prev => ({ ...prev, startAt: e.target.value }))}
            className="w-full p-3 border rounded focus:outline-indigo-500"
          />
          <input
            name="endAt"
            type="datetime-local"
            value={form.endAt}
            onChange={e => setForm(prev => ({ ...prev, endAt: e.target.value }))}
            className="w-full p-3 border rounded focus:outline-indigo-500"
          />
        </div>
        <input
          name="value"
          type="number"
          min="0"
          step="1"
          placeholder="Discount %"
          value={form.value}
          onChange={e => setForm(prev => ({ ...prev, value: e.target.value }))}
          className="w-full p-3 border rounded focus:outline-indigo-500"
        />
        <div className="space-y-2 border-t pt-4">
  <label className="flex items-start gap-2">
    <input
      type="checkbox"
      className="mt-1"
      checked={override30d}
      onChange={(e) => setOverride30d(e.target.checked)}
    />
    <span className="text-sm text-gray-800">
      Override the 30-day price rule (allow if current price is above 30-day low or no history exists).
      <span className="block text-gray-500">
        Other validations still apply. Use only with justification.
      </span>
    </span>
  </label>

  {override30d && (
    <textarea
      value={overrideReason}
      onChange={(e) => setOverrideReason(e.target.value)}
      placeholder="Why is this override necessary?"
      className="w-full p-2 border rounded"
      rows={3}
      required
    />
  )}
</div>

<button
  type="submit"
  disabled={selected.size === 0 || (override30d && overrideReason.trim().length === 0)}
  className="w-full py-3 bg-indigo-600 text-white rounded disabled:opacity-50 hover:bg-indigo-500"
>
          Create Campaign
        </button>
      </form>

      {/* tiny debug footer */}
      <pre className="text-xs text-gray-400 overflow-x-auto">
        API: {process.env.NEXT_PUBLIC_API_URL}/products?q={search}
      </pre>
    </div>
  )
}
