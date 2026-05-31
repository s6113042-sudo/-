'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/store'
import { SidebarNav } from '@/components/layout/sidebar-nav'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { state } = useApp()
  const router    = useRouter()

  useEffect(() => {
    if (!state.isOnboarded) router.replace('/')
  }, [state.isOnboarded, router])

  if (!state.isOnboarded) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <SidebarNav />
      <main style={{ flex: 1, overflowY: 'auto', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}
