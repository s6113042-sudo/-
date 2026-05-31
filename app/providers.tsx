'use client'

/**
 * Client-side providers wrapper.
 * DAppKitProvider is rendered only after hydration (mounted guard)
 * to prevent SSR mismatches with Lit web components.
 */
import { useState, useEffect, type ReactNode } from 'react'
import { DAppKitProvider } from '@mysten/dapp-kit-react'
import { AppProvider } from '@/lib/store'
import { getDAppKit } from '@/lib/sui-dapp-kit'

export function Providers({ children }: { children: ReactNode }) {
  const [kit, setKit] = useState<ReturnType<typeof getDAppKit>>(null)

  useEffect(() => {
    // Only create dAppKit on the client after hydration
    setKit(getDAppKit())
  }, [])

  // Before hydration: render without DAppKitProvider (no wallet features)
  if (!kit) {
    return <AppProvider>{children}</AppProvider>
  }

  return (
    <DAppKitProvider dAppKit={kit}>
      <AppProvider>{children}</AppProvider>
    </DAppKitProvider>
  )
}
