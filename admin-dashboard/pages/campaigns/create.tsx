import React, { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { useRouter } from 'next/router'
import Fuse from 'fuse.js'

type Variant = { id: string; name: string; price: string }

export default function CreateCampaign() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', startAt: '', endAt: '', value: '' })
  const [products, setProducts] = useState<Variant[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Fetch all product variants on mount
  useEffect(() => {
    axios
      .get<Variant[]>(`${process.env.NEXT_PUBLIC_API_URL}/products`)
      .then(res => setProducts(res.data))
      .catch(err => console.error('Failed to fetch products', err))
  }, [])

  // Initialize Fuse with higher threshold
  const fuse = useMemo(
    () => new Fuse(products, {
      keys: ['name'],
      threshold: 0.6,
      ignoreLocation: true,
      distance: 100,
    }),
    [products]
  )

  // Compute filtered products: fuzzy first, then fallback substring
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return products
    const fuzzy = fuse.search(term).map(r => r.item)
    if (fuzzy.length) return fuzzy
    // fallback to simple substring match
    return products.filter(p => p.name.toLowerCase().includes(term))
  }, [search, products, fuse])

  const toggle = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/create`,
        {
          name: form.name,
          type: 'SALE',
          startAt: form.startAt,
          endAt: form.endAt,
          variantIds: Array.from(selected),
          discountLogic: { type: 'percentage', value: Number(form.value) }
        }
      )
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
        onChange={e => setSearch(e.target.value)}
        className="w-full p-2 border rounded mb-4 focus:outline-indigo-500"
      />

      <div className="max-h-64 overflow-y-auto border p-2 rounded">
        {filtered.map(p => (
          <label
            key={p.id}
            className="flex items-center space-x-2 mb-2 hover:bg-gray-50 p-1 rounded"
          >
            <input
              type="checkbox"
              checked={selected.has(p.id)}
              onChange={() => toggle(p.id)}
              className="h-4 w-4"
            />
            <span className="text-gray-800">{p.name} • ${p.price}</span>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-500 text-center">No products match "{search}"</p>
        )}
      </div>

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
