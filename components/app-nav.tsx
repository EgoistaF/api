"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  CalendarCheck,
  Check,
  CloudOff,
  Dumbbell,
  Home,
  Languages,
  Library,
  Loader2,
  LogIn,
  Menu,
  Plus,
  Settings,
  Sparkles,
  User,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { collectDue, collectDueVerbs } from "@/lib/review"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type Destination = { href: string; label: string; icon: React.ComponentType<{ className?: string }> }

/** Shown as tabs on a phone. Five is the most that stays tappable. */
const PRIMARY: Destination[] = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/review", label: "Повторение", icon: CalendarCheck },
  { href: "/library", label: "Библиотека", icon: Library },
  { href: "/drills", label: "Тренировки", icon: Dumbbell },
]

/** Everything else: listed in the sidebar, folded into "Ещё" on a phone. */
const SECONDARY: Destination[] = [
  { href: "/catalog", label: "Каталог", icon: Languages },
  { href: "/stats", label: "Прогресс", icon: Sparkles },
  { href: "/settings", label: "Настройки", icon: Settings },
]

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}

/** Number of cards waiting for review, shown on the Повторение tab. */
function useDueCount() {
  const { state, ready } = useStore()
  return React.useMemo(() => (ready ? collectDue(state).length + collectDueVerbs(state).length : 0), [state, ready])
}

function SyncDot({ className }: { className?: string }) {
  const { account, syncStatus } = useStore()
  if (!account) return null
  if (syncStatus === "saving") return <Loader2 className={cn("size-3.5 animate-spin text-primary", className)} />
  if (syncStatus === "error") return <CloudOff className={cn("size-3.5 text-destructive", className)} />
  return <Check className={cn("size-3.5 text-chart-2", className)} />
}

/* ---------------- desktop ---------------- */

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { account } = useStore()
  const due = useDueCount()

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-card lg:flex">
      <Link href="/" className="flex items-center gap-2 px-5 py-5">
        <span className="grid size-8 place-items-center rounded-md bg-primary text-sm font-black text-primary-foreground">Q</span>
        <span className="display-type text-lg font-extrabold">QuizMaster</span>
      </Link>

      <div className="px-3">
        <Button className="w-full justify-start gap-2 rounded-md font-bold" onClick={() => router.push("/create")}>
          <Plus className="size-4" />
          Создать
        </Button>
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
        {PRIMARY.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} badge={item.href === "/review" ? due : 0} />
        ))}
        <div className="my-3 border-t" />
        {SECONDARY.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      <div className="border-t p-3">
        <Link
          href="/account"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold transition-colors hover:bg-secondary",
            isActive(pathname, "/account") && "bg-accent text-accent-foreground",
          )}
        >
          {account ? (
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-black text-primary-foreground">
              {account.displayName.slice(0, 1).toUpperCase()}
            </span>
          ) : (
            <LogIn className="size-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1 truncate">{account ? account.displayName : "Войти в профиль"}</span>
          <SyncDot />
        </Link>
        <div className="mt-1 flex justify-end">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}

function SidebarLink({ item, active, badge = 0 }: { item: Destination; active: boolean; badge?: number }) {
  return (
    <Link
      href={item.href}
      data-tour={`nav-${item.href.slice(1) || "home"}`}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold transition-colors",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <item.icon className="size-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {badge > 0 && (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
            active ? "bg-accent-foreground text-accent" : "bg-primary text-primary-foreground",
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  )
}

/* ---------------- phone ---------------- */

export function AppBottomNav() {
  const pathname = usePathname()
  const { account } = useStore()
  const due = useDueCount()
  const [moreOpen, setMoreOpen] = React.useState(false)

  const moreActive = SECONDARY.some((item) => isActive(pathname, item.href)) || isActive(pathname, "/account")

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="flex items-stretch">
        {PRIMARY.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={`nav-${item.href.slice(1) || "home"}`}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-bold transition-colors",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className={cn("rounded-md px-3 py-1", active && "bg-accent text-accent-foreground")}>
                <item.icon className="size-5" />
              </span>
              <span className="truncate">{item.label}</span>
              {item.href === "/review" && due > 0 && (
                <span className="absolute right-[18%] top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-4 text-primary-foreground">
                  {due > 99 ? "99+" : due}
                </span>
              )}
            </Link>
          )
        })}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-bold transition-colors",
                moreActive ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className={cn("rounded-md px-3 py-1", moreActive && "bg-accent text-accent-foreground")}>
                <Menu className="size-5" />
              </span>
              <span>Ещё</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-md p-0 pb-[env(safe-area-inset-bottom)]">
            <SheetTitle className="display-type px-5 pt-5 text-base">Ещё</SheetTitle>
            <div className="flex flex-col gap-1 p-3">
              <Link
                href="/account"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-bold transition-colors hover:bg-secondary"
              >
                {account ? (
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-black text-primary-foreground">
                    {account.displayName.slice(0, 1).toUpperCase()}
                  </span>
                ) : (
                  <User className="size-4 shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate">{account ? account.displayName : "Войти в профиль"}</span>
                <SyncDot />
              </Link>
              {SECONDARY.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-bold transition-colors hover:bg-secondary",
                    isActive(pathname, item.href) && "bg-accent text-accent-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              ))}
              <div className="mt-1 flex items-center justify-between rounded-md px-3 py-2">
                <span className="text-sm font-bold">Тема</span>
                <ThemeToggle />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
