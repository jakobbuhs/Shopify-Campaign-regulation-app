import React, { ReactNode } from 'react';
import Link from 'next/link';

type LayoutProps = { children: ReactNode };

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <Link href="/" className="text-lg font-semibold">Campaign Manager</Link>
          <nav className="flex gap-3">
            <Link href="/campaigns" className="rounded px-3 py-1.5 hover:bg-gray-100">Campaigns</Link>
            <Link href="/campaigns/create" className="rounded bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-500">New</Link>
          </nav>
        </div>
      </header>
      <main className="py-6">{children}</main>
    </div>
  );
}
