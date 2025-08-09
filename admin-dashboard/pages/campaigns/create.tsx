import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useRouter } from 'next/router'

type Variant = { id: string; name: string; price: string }

export default function CreateCampaign() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', startAt: '', endAt: '', value: '' })
  const [products, setProducts] = useState<Variant[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  // Toggle selection
  const toggle = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  // Debounced, cancelable search hitting your backend
  useEffect(() => {
    const controller = new AbortController()
    const id = setTimeout(async () => {
      setLoading(true)
      try {
        const resp = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/products`, {
          params: { q: search, limit: 25 },
          signal: controller.signal as any,
        })
        setProducts(resp.data.items || [])
        setNextCursor(resp.data.nextCursor ?? null)
      } catch (e: any) {
        if (e.name !== 'CanceledError' && e.code !== 'ERR_CANCELED') {
          console.error(e)
        }
      } finally {
        setLoading(false)
      }
    }, 250) // debounce

    return () => {
      controller.abort()
      clearTimeout(id)
    }
  }, [search])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/campaigns/create`, {
        name: form.name,
        type: 'SALE',
        startAt: form.startAt,
        endAt: form.endAt,
        variantIds: Array.from(selected),
        discountLogic: { type: 'percentage', value: Number(form.value) },
      })
      router.push('/')
    } catch (err) {
      console.error('❌ Failed to create campaign:', err)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold">New Campaign</h1>

      <input
        type="text"
        placeholder="Search products..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-2 border rounded mb-4 focus:outline-indigo-500"
      />

      <div className="max-h-64 overflow-y-auto border p-2 rounded">
        {loading && <p className="text-gray-500 text-center">Searching…</p>}

        {!loading && products.map((p) => (
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
      </div>

      {nextCursor && (
        <button
          type="button"
          onClick={async () => {
            const resp = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/products`, {
              params: { q: search, limit: 25, cursor: nextCursor },
            })
            setProducts((prev) => [...prev, ...(resp.data.items || [])])
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
          placeholder="Discount %"
          value={form.value}
          onChange={e => setForm(prev => ({ ...prev, value: e.target.value }))}
          className="w-full p-3 border rounded focus:outline-indigo-500"
        />
        <button
          type="submit"
          disabled={selected.size === 0}
          className="w-full py-3 bg-indigo-600 text-white rounded disabled:opacity-50 hover:bg-indigo-500"
        >
          Create Campaign
        </button>
      </form>
    </div>
  )
}
