import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
export default function CampaignDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<any>(null);
  useEffect(() => { if (id) axios.get(`${process.env.NEXT_PUBLIC_API_URL}/campaigns/${id}`).then(res => setData(res.data)); }, [id]);
  if (!data) return <p>Loading...</p>;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-indigo-600">{data.name}</h1>
      <p className="text-gray-700">Status: {data.status}</p>
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">Variants</h2>
        <ul className="list-disc pl-5 text-gray-600">
          {data.campaignProducts.map((p:any) => <li key={p.id}>{p.variantId}</li>)}
        </ul>
      </section>
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">Price History</h2>
        <ul className="list-disc pl-5 text-gray-600">
          {data.priceHistory.map((h:any) => <li key={h.id}>{new Date(h.changedAt).toLocaleString()}: {h.price}</li>)}
        </ul>
      </section>
    </div>
  );
}