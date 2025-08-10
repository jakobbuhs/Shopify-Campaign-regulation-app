import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">Campaign Manager</h1>
        <p className="mt-2 text-gray-600">
          Create, schedule, and stay compliant with Norway’s pricing rules.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            href="/campaigns"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-white font-medium hover:bg-indigo-500"
          >
            View all campaigns
          </Link>
          <Link
            href="/campaigns/create"
            className="inline-flex items-center justify-center rounded-lg border px-4 py-2.5 font-medium text-gray-800 hover:bg-gray-50"
          >
            + New campaign
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">What’s next?</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 space-y-1">
            <li>Create a campaign and pick products with live search.</li>
            <li>We’ll check 30-day min price before activating.</li>
            <li>See Active/Draft/Finished in the campaigns list.</li>
          </ul>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Shortcuts</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/campaigns?status=ACTIVE" className="rounded border px-3 py-1.5 hover:bg-gray-50">
              Active
            </Link>
            <Link href="/campaigns?status=DRAFT" className="rounded border px-3 py-1.5 hover:bg-gray-50">
              Draft
            </Link>
            <Link href="/campaigns?status=FINISHED" className="rounded border px-3 py-1.5 hover:bg-gray-50">
              Finished
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
