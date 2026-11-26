"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Download, RefreshCw, Sparkles, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import { plural } from "@/lib/text"
import { AI_MODELS, DEFAULT_MODEL, fetchAiStatus, loadAiSettings, saveAiSettings, type AiSettings } from "@/lib/ai"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function SettingsPage() {
  const { state, ready, updateSettings, exportState, importState, resetAll, demoSetCount, removeDemoSets } = useStore()
  const router = useRouter()
  const [raw, setRaw] = React.useState("")
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [ai, setAi] = React.useState<AiSettings>({ apiKey: "", model: DEFAULT_MODEL })
  const [serverKey, setServerKey] = React.useState(false)

  React.useEffect(() => {
    setAi(loadAiSettings())
    fetchAiStatus().then((status) => setServerKey(status.serverKey))
  }, [])

  function changeAi(patch: Partial<AiSettings>) {
    setAi((prev) => {
      const next = { ...prev, ...patch }
      saveAiSettings(next)
      return next
    })
  }

  if (!ready) return <Skeleton className="mx-auto mt-10 h-64 max-w-2xl rounded-xl" />

  const demoCount = demoSetCount()

  function download() {
    const blob = new Blob([exportState()], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `quizmaster-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Резервная копия сохранена")
  }

  function handleImport(text: string) {
    const result = importState(text)
    if (result.ok) {
      toast.success(result.message)
      setRaw("")
    } else {
      toast.error(result.message)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="display-type text-2xl font-extrabold tracking-tight">Настройки</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Все данные хранятся только в этом браузере — аккаунт и подписка не нужны.
      </p>

      <section className="mt-6 space-y-5 rounded-xl border bg-card p-5">
        <h2 className="display-type font-extrabold">Изучение</h2>
        <Row label="Озвучка терминов" hint="Показывать кнопку синтеза речи">
          <Switch checked={state.settings.ttsEnabled} onCheckedChange={(checked) => updateSettings({ ttsEnabled: checked })} />
        </Row>
        <Row label="Сначала термин, потом перевод" hint="Выключите — и все режимы спросят наоборот: перевод, потом термин">
          <Switch checked={state.settings.frontIsTerm} onCheckedChange={(checked) => updateSettings({ frontIsTerm: checked })} />
        </Row>
        <Row label="Подсказки по приложению" hint="Короткий тур: что где находится">
          <Button
            variant="outline"
            size="sm"
            className="font-bold"
            onClick={() => {
              updateSettings({ tourSeen: false })
              toast.success("Подсказки покажутся на главной")
              router.push("/")
            }}
          >
            <Sparkles className="size-4" />
            Показать заново
          </Button>
        </Row>
        <Row label="Игнорировать диакритику" hint="café = cafe при проверке ответа">
          <Switch
            checked={state.settings.accentInsensitive}
            onCheckedChange={(checked) => updateSettings({ accentInsensitive: checked })}
          />
        </Row>
        <Row label="Тип вопросов в «Заучивании»" hint="Смешанный режим подбирает тип под ваш уровень" wide>
          <Select value={state.settings.learnMode} onValueChange={(value) => updateSettings({ learnMode: value as "mixed" | "choice" | "written" })}>
            <SelectTrigger className="w-full sm:w-[13rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mixed">Смешанные</SelectItem>
              <SelectItem value="choice">Только выбор</SelectItem>
              <SelectItem value="written">Только ввод</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label={`Пауза автопрокрутки: ${state.settings.autoplayDelay} с`} hint="Для режима «Карточки»" wide>
          <input
            type="range"
            min={2}
            max={12}
            value={state.settings.autoplayDelay}
            onChange={(event) => updateSettings({ autoplayDelay: Number(event.target.value) })}
            className="w-full accent-primary sm:w-40"
          />
        </Row>
      </section>

      <section id="ai" className="mt-6 space-y-4 rounded-xl border bg-card p-5 scroll-mt-20">
        <h2 className="display-type font-extrabold">Распознавание с ИИ</h2>
        <p className="text-sm text-muted-foreground">
          На странице импорта появляется кнопка «Распознать с ИИ»: снимок уходит в Anthropic, а модель возвращает
          готовые пары — она разбирает и почерк, и таблицы, с которыми обычное распознавание не справляется. Само
          распознавание в браузере остаётся бесплатным и никуда ничего не отправляет.
        </p>

        <div className="space-y-2">
          <Label htmlFor="ai-key">Ключ Anthropic API</Label>
          <Input
            id="ai-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={ai.apiKey}
            onChange={(event) => changeAi({ apiKey: event.target.value })}
            placeholder={serverKey ? "Ключ уже настроен на сервере" : "sk-ant-…"}
            className="h-11 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            {serverKey
              ? "Сервер уже обращается к модели своим ключом — это поле можно оставить пустым."
              : "Ключ хранится только в этом браузере, не попадает в резервную копию и не синхронизируется."}{" "}
            Взять его можно на console.anthropic.com, запросы оплачиваются по тарифам Anthropic.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Модель</Label>
          <Select value={ai.model} onValueChange={(value) => changeAi({ model: value })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {AI_MODELS.find((model) => model.id === ai.model)?.note}
          </p>
        </div>
      </section>

      <section id="import" className="mt-6 space-y-4 rounded-xl border bg-card p-5 scroll-mt-20">
        <h2 className="display-type font-extrabold">Данные</h2>
        <p className="text-sm text-muted-foreground">
          Сохраните копию, чтобы перенести модули на другое устройство или в другой браузер.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={download} className="rounded-full font-bold">
            <Download className="size-4" />
            Скачать копию (JSON)
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="rounded-full font-bold">
            <Upload className="size-4" />
            Загрузить из файла
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              handleImport(await file.text())
              event.target.value = ""
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="raw">…или вставьте JSON вручную</Label>
          <Textarea
            id="raw"
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            rows={5}
            placeholder='{"sets": [...]} или [{"title": "…", "terms": [...]}]'
            className="font-mono text-xs"
          />
          <Button disabled={!raw.trim()} onClick={() => handleImport(raw)} variant="secondary" className="font-bold">
            Импортировать
          </Button>
        </div>
      </section>

      {demoCount > 0 && (
        <section className="mt-6 space-y-3 rounded-xl border bg-card p-5">
          <h2 className="display-type font-extrabold">Примеры</h2>
          <p className="text-sm text-muted-foreground">
            В библиотеке лежат {demoCount} {plural(demoCount, "демо-модуль", "демо-модуля", "демо-модулей")}, которые
            приложение создало при первом запуске. Ваши модули и прогресс это не затронет.
          </p>
          <Button
            variant="outline"
            className="rounded-md font-bold"
            onClick={() => {
              const removed = removeDemoSets()
              toast.success(`Удалено: ${removed}`)
            }}
          >
            <Sparkles className="size-4" />
            Убрать примеры
          </Button>
        </section>
      )}

      <section className="mt-6 space-y-4 rounded-xl border bg-card p-5">
        <h2 className="display-type font-extrabold">Сброс</h2>
        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="rounded-full font-bold">
                <RefreshCw className="size-4" />
                Вернуть демо-модули
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Заменить всё демо-набором?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ваши текущие модули и прогресс будут удалены, вместо них появятся четыре учебных модуля для примера.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    resetAll(true)
                    toast.success("Демо-модули восстановлены")
                  }}
                >
                  Заменить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="rounded-full font-bold text-destructive hover:text-destructive">
                <Trash2 className="size-4" />
                Удалить все данные
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить всё безвозвратно?</AlertDialogTitle>
                <AlertDialogDescription>
                  Будут удалены все модули ({state.sets.length}), папки и статистика. Сначала лучше скачать резервную копию.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    resetAll(false)
                    toast.success("Данные удалены")
                  }}
                >
                  Удалить всё
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        QuizMaster · все режимы бесплатны и без ограничений
      </p>
    </div>
  )
}

/**
 * A setting and its control. A switch is narrow enough to sit beside the
 * label at any width; a dropdown or a slider is not, and on a phone it would
 * squeeze the label into a column one word across — those rows pass `wide`
 * and stack instead.
 */
function Row({
  label,
  hint,
  wide = false,
  children,
}: {
  label: string
  hint?: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex gap-4",
        wide ? "flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4" : "items-center justify-between",
      )}
    >
      <div className="min-w-0">
        <Label className="text-sm font-bold">{label}</Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className={cn(wide ? "w-full sm:w-auto sm:shrink-0" : "shrink-0")}>{children}</div>
    </div>
  )
}
