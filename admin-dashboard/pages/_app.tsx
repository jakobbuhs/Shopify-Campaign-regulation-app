// pages/_app.tsx - Application root with global styles and layout
import React from 'react'
import type { AppProps } from 'next/app'
import '../styles/globals.css'           // ← this import is REQUIRED
import Layout from '../components/Layout'

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  )
}

