import React, { ReactNode } from 'react'
import Link from 'next/link'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">Reprice Admin</h1>
          <nav>
            <Link href="/" className="text-gray-700 hover:text-indigo-600 px-4">
              Dashboard
            </Link>
            <Link
              href="/campaigns/create"
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-500"
            >
              New Campaign
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-6">{children}</main>
    </div>
  )
}
