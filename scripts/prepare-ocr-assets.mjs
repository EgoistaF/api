/**
 * Copies the text-recognition engine and its language data into public/.
 *
 * They come from npm and are regenerated on every build, so they are not in
 * git: the repository stays small and the app still serves everything from
 * its own origin instead of depending on a third-party CDN.
 */
import { copyFileSync, mkdirSync, existsSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const require = createRequire(import.meta.url)
const to = (...parts) => path.join(ROOT, "public", ...parts)

/**
 * Resolved through the module system rather than by guessing a path inside
 * node_modules: pnpm does not hoist, so "node_modules/<pkg>" only exists for
 * some installs.
 */
function from(spec) {
  const slash = spec.indexOf("/")
  const pkg = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.slice(0, slash)
  const rest = spec.slice(pkg.length + 1)
  const base = path.dirname(require.resolve(`${pkg}/package.json`))
  return path.join(base, rest)
}

/** best_int: markedly more accurate than fast, a fraction of the size of best. */
const FILES = [
  [from("@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz"), to("tessdata", "deu.traineddata.gz")],
  [from("@tesseract.js-data/rus/4.0.0_best_int/rus.traineddata.gz"), to("tessdata", "rus.traineddata.gz")],
  [from("tesseract.js/dist/worker.min.js"), to("tesseract", "worker.min.js")],
  // LSTM-only cores, the only ones these traineddata files need. All three
  // instruction-set flavours are shipped because the browser picks one at
  // runtime; a visitor downloads exactly one of them.
  ...["", "-simd", "-relaxedsimd"].map((flavour) => [
    from(`tesseract.js-core/tesseract-core${flavour}-lstm.wasm.js`),
    to("tesseract", `tesseract-core${flavour}-lstm.wasm.js`),
  ]),
]

let copied = 0
let bytes = 0
for (const [source, target] of FILES) {
  if (!existsSync(source)) {
    console.error(`[ocr-assets] missing: ${path.relative(ROOT, source)}`)
    process.exit(1)
  }
  mkdirSync(path.dirname(target), { recursive: true })
  copyFileSync(source, target)
  copied += 1
  bytes += statSync(target).size
}
console.log(`[ocr-assets] ${copied} files, ${(bytes / 1048576).toFixed(1)} MB`)
