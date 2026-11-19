# Tests

Two kinds, both runnable without any service account.

```bash
npm run check      # pure logic: answer grading and verb conjugation
npm run test:e2e   # browser suites against a running app
npm run screenshots  # captures every screen, light and dark
```

`npm run check` needs nothing but Node. It verifies answer grading against
every card in the built-in course, and the conjugation engine against
invariants plus hand-written tables.

The browser suites need the app running and Playwright available:

```bash
npm run build && npm start      # in one terminal
npm i -D playwright && npx playwright install chromium
npm run test:e2e                # in another
```

Point them at a deployment with `BASE`:

```bash
BASE=https://your-app.vercel.app npm run test:e2e
```

Run one suite by name: `npm run test:e2e -- verbs`.

Screenshots land in `tests/.artifacts/`, which is not tracked.

## Suites

| Suite | What it covers |
|---|---|
| `app` | The whole flow: empty start, adding the course, all six study modes, search, stats, persistence, dark theme, phone layout |
| `navigation` | Tab bar on a phone, sidebar on a desktop, study modes stripped of chrome, the review badge |
| `study-modes` | Scheduled review and the article trainer |
| `verbs` | The conjugation trainer, driven by the real engine: answers computed with `conjugate()` must be accepted |
| `verbs-review` | Practised verbs joining the review schedule, the badge, the stats section |
| `catalog` | Adding the German course, folder preselection, duplicate handling |
| `import-ocr` | Reading a two-column word list from a generated screenshot |
| `answer-grading` | The cards that were once graded wrongly, end to end |
| `contrast` | Every page in both themes measured against WCAG AA |
| `account` | The profile screen, and that an outage is never reported as a wrong password |
| `account-sync` | Two devices sharing one profile. Skips itself when the profile store is unavailable |
