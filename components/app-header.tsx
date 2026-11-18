"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookOpen, FolderPlus, Languages, Plus, Search, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Slim top bar: search and creating. Getting around is the navigation's job —
 * the sidebar on a wide screen, the tab bar on a phone.
 */
export function AppHeader() {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const searchRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      if (event.key === "/" && !typing) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = query.trim()
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search")
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 lg:hidden">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-sm font-black text-primary-foreground">Q</span>
          <span className="display-type hidden text-base font-extrabold sm:inline">QuizMaster</span>
        </Link>

        <form onSubmit={submitSearch} className="relative ml-auto hidden max-w-md flex-1 sm:block lg:ml-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск модулей и терминов  ( / )"
            className="h-10 rounded-md border-transparent bg-muted pl-9 pr-9 focus-visible:bg-card"
            aria-label="Поиск"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Очистить"
            >
              <X className="size-4" />
            </button>
          )}
        </form>

        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => router.push("/search")} aria-label="Поиск">
            <Search className="size-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-10 gap-1.5 rounded-md px-3 font-bold sm:px-4">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Создать</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => router.push("/create")}>
                <BookOpen className="size-4" />
                Учебный модуль
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/library?new=folder")}>
                <FolderPlus className="size-4" />
                Папка
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/catalog")}>
                <Languages className="size-4" />
                Готовый курс немецкого
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings#import")}>
                <Upload className="size-4" />
                Импорт из файла
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
