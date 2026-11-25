"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, ImagePlus, Loader2, ScanText, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import { makeId } from "@/lib/seed"
import { plural } from "@/lib/text"
import type { ParsedPair } from "@/lib/text"
import { recognizePairs, type OcrProgress } from "@/lib/ocr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Shot = { id: string; file: File; url: string }
type Row = ParsedPair & { id: string }

export default function ImportPage() {
  const router = useRouter()
  const { state, ready, createSet, createFolder } = useStore()

  const [shots, setShots] = React.useState<Shot[]>([])
  const [rows, setRows] = React.useState<Row[]>([])
  const [busy, setBusy] = React.useState(false)
  const [progress, setProgress] = React.useState<OcrProgress | null>(null)
  const [title, setTitle] = React.useState("")
  const [folderId, setFolderId] = React.useState("none")
  const fileRef = React.useRef<HTMLInputElement>(null)

  const addFiles = React.useCallback((files: FileList | File[] | null) => {
    if (!files) return
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"))
    if (!images.length) return
    setShots((prev) => [...prev, ...images.map((file) => ({ id: makeId("img"), file, url: URL.createObjectURL(file) }))])
  }, [])

  // Pasting a screenshot straight from the clipboard is the fastest route.
  React.useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? [])
      if (files.length) {
        event.preventDefault()
        addFiles(files)
      }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [addFiles])

  React.useEffect(() => () => shots.forEach((shot) => URL.revokeObjectURL(shot.url)), [shots])

  async function run() {
    if (!shots.length) return
    setBusy(true)
    setProgress({ stage: "Подготовка", percent: 0 })
    try {
      const pairs = await recognizePairs(
        shots.map((shot) => shot.file),
        setProgress,
      )
      setRows(pairs.map((pair) => ({ ...pair, id: makeId("row") })))
      if (!pairs.length) toast.error("Не удалось разобрать текст. Попробуйте снимок покрупнее.")
      else toast.success(`Распознано строк: ${pairs.length}`)
    } catch (error) {
      console.error(error)
      toast.error("Распознавание не удалось")
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  function save() {
    const terms = rows
      .map((row) => ({ term: row.term.trim(), definition: row.definition.trim() }))
      .filter((row) => row.term && row.definition)
    if (!terms.length) {
      toast.error("Нужна хотя бы одна заполненная пара")
      return
    }
    let folder: string | null = null
    if (folderId === "__new") {
      const name = window.prompt("Название новой папки", "Deutsch")
      if (name?.trim()) folder = createFolder(name.trim())
    } else if (folderId !== "none") {
      folder = folderId
    }
    const id = createSet({
      title: title.trim() || `Со скриншота · ${new Date().toLocaleDateString("ru-RU")}`,
      description: "",
      termLang: "de-DE",
      defLang: "ru-RU",
      folderId: folder,
      terms: terms.map((row) => ({ id: makeId("t"), term: row.term, definition: row.definition, starred: false })),
    })
    toast.success(`Модуль создан: ${terms.length} ${plural(terms.length, "карточка", "карточки", "карточек")}`)
    router.push(`/set/${id}`)
  }

  if (!ready) return <Skeleton className="mx-auto mt-10 h-96 max-w-3xl rounded-xl" />

  const filled = rows.filter((row) => row.term.trim() && row.definition.trim()).length

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <ScanText className="size-6" />
        </span>
        <div>
          <h1 className="display-type text-2xl font-extrabold tracking-tight">Импорт со скриншота</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Добавьте снимки списка слов — текст распознается прямо в браузере, без отправки куда-либо.
          </p>
        </div>
      </div>

      {/* 1. pick images */}
      <section className="mt-6">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            addFiles(event.target.files)
            event.target.value = ""
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            addFiles(event.dataTransfer.files)
          }}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed bg-card py-10 font-bold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <ImagePlus className="size-7" />
          Выбрать скриншоты
          <span className="text-xs font-semibold">или перетащите сюда, или вставьте из буфера (Ctrl+V)</span>
          <span className="text-xs font-normal">Скриншот читается точнее фото, но и снимок с экрана подойдёт</span>
        </button>

        {shots.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {shots.map((shot) => (
              <div key={shot.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shot.url} alt="" className="h-28 w-20 rounded-md border object-cover" />
                <button
                  type="button"
                  aria-label="Убрать"
                  onClick={() => setShots((prev) => prev.filter((item) => item.id !== shot.id))}
                  className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border bg-card text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button
          size="lg"
          className="mt-4 h-12 w-full rounded-md font-bold"
          disabled={!shots.length || busy}
          onClick={run}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ScanText className="size-4" />}
          {busy ? (progress ? `${progress.stage} ${progress.percent}%` : "Распознаю…") : "Распознать текст"}
        </Button>
        {busy && progress && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
        )}
        {busy && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            В первый раз движок и словари загружаются примерно на 10 МБ, дальше они берутся из кэша.
          </p>
        )}
      </section>

      {/* 2. check what was read */}
      {rows.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="display-type text-lg font-extrabold">Проверьте строки</h2>
            <p className="text-sm font-bold text-muted-foreground">
              {filled} из {rows.length} готовы
            </p>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            У таблицы в несколько колонок все формы слова собираются в «Термин», а перевод — в «Перевод». Распознавание
            ошибается на мелком шрифте — поправьте, что нужно. Пустые строки не попадут в модуль.
          </p>

          <div className="space-y-2">
            {rows.map((row, index) => (
              <div key={row.id} className="flex items-start gap-2 rounded-md border bg-card p-2">
                <span className="w-6 shrink-0 pt-2.5 text-center text-xs font-bold text-muted-foreground">{index + 1}</span>
                <Input
                  value={row.term}
                  onChange={(event) =>
                    setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, term: event.target.value } : item)))
                  }
                  placeholder="Термин"
                  className="h-10 flex-1 font-semibold"
                />
                <Input
                  value={row.definition}
                  onChange={(event) =>
                    setRows((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, definition: event.target.value } : item)),
                    )
                  }
                  placeholder="Перевод"
                  className="h-10 flex-1 font-semibold"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Удалить строку"
                  onClick={() => setRows((prev) => prev.filter((item) => item.id !== row.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* 3. save */}
          <div className="mt-6 space-y-4 rounded-xl border bg-card p-5">
            <div className="space-y-2">
              <Label htmlFor="import-title">Название модуля</Label>
              <Input
                id="import-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Например: Teil 5"
                className="h-11 font-semibold"
              />
            </div>
            <div className="space-y-2">
              <Label>Папка</Label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без папки</SelectItem>
                  {state.folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new">+ Новая папка…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="lg" className="h-12 w-full rounded-md font-bold" onClick={save} disabled={!filled}>
              Создать модуль · {filled} {plural(filled, "карточка", "карточки", "карточек")}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Нужен текстовый список вместо картинки?{" "}
        <Link href="/create" className="font-bold text-primary underline">
          Обычный импорт
        </Link>
      </p>
    </div>
  )
}
