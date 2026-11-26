"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { AppBottomNav, AppSidebar } from "@/components/app-nav"
import { Tour } from "@/components/tour"

/** Study modes take the whole screen: no header, no navigation, no distractions. */
const STUDY_ROUTE = /\/(flashcards|learn|write|spell|test|match)$/

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (STUDY_ROUTE.test(pathname)) {
    return <main className="min-h-dvh">{children}</main>
  }

  return (
    <div className="lg:flex">
      <AppSidebar />
      <div className="flex min-h-dvh flex-1 flex-col">
        <AppHeader />
        {/* Room for the tab bar, which floats over the page on a phone. */}
        <main className="flex-1 pb-24 lg:pb-0">{children}</main>
      </div>
      <AppBottomNav />
      <Tour />
    </div>
  )
}
