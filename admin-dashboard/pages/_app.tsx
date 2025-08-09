// pages/_app.tsx - Application root with global styles and layout
import React from 'react'
import type { AppProps } from 'next/app'
import Layout from '../components/Layout'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  )
}
