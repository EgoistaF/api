import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { StoreProvider } from "@/lib/store"
import { AppShell } from "@/components/app-shell"
import { Toaster } from "@/components/ui/sonner"
import "./fonts.css"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "QuizMaster — карточки, учить, тесты",
    template: "%s · QuizMaster",
  },
  description:
    "Бесплатные флеш-карточки без лимитов: режимы «Карточки», «Заучивание», «Письмо», «Диктант», «Тест» и игра «Подбор». Всё работает прямо в браузере.",
  applicationName: "QuizMaster",
  keywords: ["флеш-карточки", "quizlet", "учить слова", "тесты", "подготовка к экзамену"],
  icons: {
    // Launchers and iOS take the PNGs; the SVG is for the browser tab.
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  manifest: "/manifest.webmanifest",
}

export const viewport: Viewport = {
  // Matches --card: the header and the tab bar sit against the phone's own
  // status and gesture bars, so the seam should be invisible.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      {/* The fonts are served from this repository; see app/fonts.css. */}
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <StoreProvider>
            <AppShell>{children}</AppShell>
            <Toaster position="top-center" />
          </StoreProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
