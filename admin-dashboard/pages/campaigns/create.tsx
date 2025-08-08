import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
export default function CreateCampaign() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', startAt: '', endAt: '', variantIds: '', value: '' });
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/campaigns/create`, {
      name: form.name,
      type: 'SALE',
      startAt: form.startAt,
      endAt: form.endAt,
      variantIds: form.variantIds.split(',').map(s => s.trim()),
      discountLogic: { type: 'percentage', value: Number(form.value) }
    });
    router.push('/');
  };
  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6 text-center">Create Campaign</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="name" placeholder="Campaign Name" value={form.name} onChange={handleChange} className="w-full p-3 border rounded" />
        <input name="startAt" type="datetime-local" value={form.startAt} onChange={handleChange} className="w-full p-3 border rounded" />
        <input name="endAt" type="datetime-local" value={form.endAt} onChange={handleChange} className="w-full p-3 border rounded" />
        <input name="variantIds" placeholder="Variant IDs, comma-separated" value={form.variantIds} onChange={handleChange} className="w-full p-3 border rounded" />
        <input name="value" placeholder="Discount %" value={form.value} onChange={handleChange} className="w-full p-3 border rounded" />
        <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded hover:bg-indigo-500">Create Campaign</button>
      </form>
    </div>
  );
}
