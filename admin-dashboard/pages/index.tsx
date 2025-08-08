import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

type Campaign = { id: number; name: string; status: string; startAt: string };
export default function Home() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  useEffect(() => {
    axios.get(`${process.env.NEXT_PUBLIC_API_URL}/campaigns`).then(res => setCampaigns(res.data));
  }, []);
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {campaigns.map(c => (
        <div key={c.id} className="bg-white p-6 rounded-lg shadow hover:shadow-lg">
          <h2 className="text-xl font-semibold mb-2 text-indigo-600">
            <Link href={`/campaigns/${c.id}`}>{c.name}</Link>
          </h2>
          <p className="text-gray-500 mb-1">Status: {c.status}</p>
          <p className="text-gray-500">Starts: {new Date(c.startAt).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}