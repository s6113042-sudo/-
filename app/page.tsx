'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/store'
import { Onboarding } from '@/components/onboarding'

export default function RootPage() {
  const { state } = useApp()
  const router    = useRouter()

  useEffect(() => {
    if (state.isOnboarded) router.replace('/dashboard')
  }, [state.isOnboarded, router])

  if (state.isOnboarded) return null
  return <Onboarding />
}
