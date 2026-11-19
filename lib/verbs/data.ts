import type { VerbEntry } from "./types.ts"

/**
 * Verbs for the conjugation trainer, A1 to B1.
 *
 * Each entry carries only what the rules in conjugate.ts cannot derive: the
 * auxiliary, a stem change, the Präteritum stem of a strong verb, the
 * Partizip II, and an irregular imperative. Weak verbs carry almost nothing,
 * because for them the rules are the whole truth.
 *
 * Konjunktiv II is listed only where the simple form is actually used. Every
 * other verb forms it with würde + Infinitiv, which is both correct and what
 * learners are taught.
 *
 * Reflexive verbs are left out on purpose: their pronoun changes with the
 * person and would make the expected answer ambiguous.
 */
export const VERBS: VerbEntry[] = [
  /* ---------- the three that carry the grammar ---------- */
  {
    infinitive: "sein", translation: "быть", level: "A1", aux: "sein",
    present: { ich: "bin", du: "bist", er: "ist", wir: "sind", ihr: "seid", sie: "sind" },
    praeteritum: "war", partizip: "gewesen",
    konjunktiv2: { ich: "wäre", du: "wärst", er: "wäre", wir: "wären", ihr: "wärt", sie: "wären" },
    imperativDu: "sei", imperativSie: "seien Sie",
  },
  {
    infinitive: "haben", translation: "иметь", level: "A1", aux: "haben",
    present: { du: "hast", er: "hat" }, praeteritum: "hatte", partizip: "gehabt", konjunktiv2: "hätte",
  },
  {
    infinitive: "werden", translation: "становиться", level: "A1", aux: "sein",
    present: { du: "wirst", er: "wird" }, praeteritum: "wurde", partizip: "geworden", konjunktiv2: "würde",
  },

  /* ---------- modal verbs ---------- */
  { infinitive: "können", translation: "мочь, уметь", level: "A1", aux: "haben", present: { ich: "kann", du: "kannst", er: "kann" }, praeteritum: "konnte", partizip: "gekonnt", konjunktiv2: "könnte", noImperative: true },
  { infinitive: "müssen", translation: "быть должным", level: "A1", aux: "haben", present: { ich: "muss", du: "musst", er: "muss" }, praeteritum: "musste", partizip: "gemusst", konjunktiv2: "müsste", noImperative: true },
  { infinitive: "wollen", translation: "хотеть", level: "A1", aux: "haben", present: { ich: "will", du: "willst", er: "will" }, praeteritum: "wollte", partizip: "gewollt", konjunktiv2: "wollte", noImperative: true },
  { infinitive: "dürfen", translation: "иметь право", level: "A1", aux: "haben", present: { ich: "darf", du: "darfst", er: "darf" }, praeteritum: "durfte", partizip: "gedurft", konjunktiv2: "dürfte", noImperative: true },
  { infinitive: "sollen", translation: "следует, должен", level: "A1", aux: "haben", present: { ich: "soll", du: "sollst", er: "soll" }, praeteritum: "sollte", partizip: "gesollt", konjunktiv2: "sollte", noImperative: true },
  { infinitive: "mögen", translation: "любить, нравиться", level: "A1", aux: "haben", present: { ich: "mag", du: "magst", er: "mag" }, praeteritum: "mochte", partizip: "gemocht", konjunktiv2: "möchte", noImperative: true },
  { infinitive: "wissen", translation: "знать", level: "A1", aux: "haben", present: { ich: "weiß", du: "weißt", er: "weiß" }, praeteritum: "wusste", partizip: "gewusst", konjunktiv2: "wüsste", noImperative: true },

  /* ---------- strong verbs: a → ä ---------- */
  { infinitive: "fahren", translation: "ехать", level: "A1", aux: "sein", present: { du: "fährst", er: "fährt" }, praeteritum: "fuhr", partizip: "gefahren" },
  { infinitive: "laufen", translation: "бежать, идти пешком", level: "A1", aux: "sein", present: { du: "läufst", er: "läuft" }, praeteritum: "lief", partizip: "gelaufen" },
  { infinitive: "schlafen", translation: "спать", level: "A1", aux: "haben", present: { du: "schläfst", er: "schläft" }, praeteritum: "schlief", partizip: "geschlafen" },
  { infinitive: "tragen", translation: "носить", level: "A2", aux: "haben", present: { du: "trägst", er: "trägt" }, praeteritum: "trug", partizip: "getragen" },
  { infinitive: "halten", translation: "держать, останавливаться", level: "A2", aux: "haben", present: { du: "hältst", er: "hält" }, praeteritum: "hielt", partizip: "gehalten" },
  { infinitive: "fallen", translation: "падать", level: "A2", aux: "sein", present: { du: "fällst", er: "fällt" }, praeteritum: "fiel", partizip: "gefallen" },
  { infinitive: "gefallen", translation: "нравиться", level: "A2", aux: "haben", present: { du: "gefällst", er: "gefällt" }, praeteritum: "gefiel", partizip: "gefallen", noImperative: true },
  { infinitive: "lassen", translation: "оставлять, позволять", level: "A2", aux: "haben", present: { du: "lässt", er: "lässt" }, praeteritum: "ließ", partizip: "gelassen" },
  { infinitive: "waschen", translation: "мыть, стирать", level: "A2", aux: "haben", present: { du: "wäschst", er: "wäscht" }, praeteritum: "wusch", partizip: "gewaschen" },
  { infinitive: "wachsen", translation: "расти", level: "B1", aux: "sein", present: { du: "wächst", er: "wächst" }, praeteritum: "wuchs", partizip: "gewachsen" },
  { infinitive: "fangen", translation: "ловить", level: "B1", aux: "haben", present: { du: "fängst", er: "fängt" }, praeteritum: "fing", partizip: "gefangen" },
  { infinitive: "verlassen", translation: "покидать", level: "B1", aux: "haben", present: { du: "verlässt", er: "verlässt" }, praeteritum: "verließ", partizip: "verlassen" },

  /* ---------- strong verbs: e → i / ie ---------- */
  { infinitive: "sehen", translation: "видеть", level: "A1", aux: "haben", present: { du: "siehst", er: "sieht" }, praeteritum: "sah", partizip: "gesehen", imperativDu: "sieh" },
  { infinitive: "lesen", translation: "читать", level: "A1", aux: "haben", present: { du: "liest", er: "liest" }, praeteritum: "las", partizip: "gelesen", imperativDu: "lies" },
  { infinitive: "sprechen", translation: "говорить", level: "A1", aux: "haben", present: { du: "sprichst", er: "spricht" }, praeteritum: "sprach", partizip: "gesprochen", imperativDu: "sprich" },
  { infinitive: "essen", translation: "есть, кушать", level: "A1", aux: "haben", present: { du: "isst", er: "isst" }, praeteritum: "aß", partizip: "gegessen", imperativDu: "iss" },
  { infinitive: "geben", translation: "давать", level: "A1", aux: "haben", present: { du: "gibst", er: "gibt" }, praeteritum: "gab", partizip: "gegeben", imperativDu: "gib" },
  { infinitive: "nehmen", translation: "брать", level: "A1", aux: "haben", present: { du: "nimmst", er: "nimmt" }, praeteritum: "nahm", partizip: "genommen", imperativDu: "nimm" },
  { infinitive: "treffen", translation: "встречать", level: "A2", aux: "haben", present: { du: "triffst", er: "trifft" }, praeteritum: "traf", partizip: "getroffen", imperativDu: "triff" },
  { infinitive: "helfen", translation: "помогать", level: "A2", aux: "haben", present: { du: "hilfst", er: "hilft" }, praeteritum: "half", partizip: "geholfen", imperativDu: "hilf" },
  { infinitive: "vergessen", translation: "забывать", level: "A2", aux: "haben", present: { du: "vergisst", er: "vergisst" }, praeteritum: "vergaß", partizip: "vergessen", imperativDu: "vergiss" },
  { infinitive: "werfen", translation: "бросать", level: "B1", aux: "haben", present: { du: "wirfst", er: "wirft" }, praeteritum: "warf", partizip: "geworfen", imperativDu: "wirf" },
  { infinitive: "brechen", translation: "ломать", level: "B1", aux: "haben", present: { du: "brichst", er: "bricht" }, praeteritum: "brach", partizip: "gebrochen", imperativDu: "brich" },
  { infinitive: "sterben", translation: "умирать", level: "B1", aux: "sein", present: { du: "stirbst", er: "stirbt" }, praeteritum: "starb", partizip: "gestorben", imperativDu: "stirb" },
  { infinitive: "treten", translation: "ступать", level: "B1", aux: "sein", present: { du: "trittst", er: "tritt" }, praeteritum: "trat", partizip: "getreten", imperativDu: "tritt" },
  { infinitive: "empfehlen", translation: "рекомендовать", level: "B1", aux: "haben", present: { du: "empfiehlst", er: "empfiehlt" }, praeteritum: "empfahl", partizip: "empfohlen", imperativDu: "empfiehl" },
/* ---------- strong verbs without a stem change ---------- */
  { infinitive: "gehen", translation: "идти", level: "A1", aux: "sein", praeteritum: "ging", partizip: "gegangen" },
  { infinitive: "kommen", translation: "приходить", level: "A1", aux: "sein", praeteritum: "kam", partizip: "gekommen" },
  { infinitive: "trinken", translation: "пить", level: "A1", aux: "haben", praeteritum: "trank", partizip: "getrunken" },
  { infinitive: "finden", translation: "находить, считать", level: "A1", aux: "haben", praeteritum: "fand", partizip: "gefunden" },
  { infinitive: "heißen", translation: "зваться", level: "A1", aux: "haben", praeteritum: "hieß", partizip: "geheißen" },
  { infinitive: "schreiben", translation: "писать", level: "A1", aux: "haben", praeteritum: "schrieb", partizip: "geschrieben" },
  { infinitive: "bleiben", translation: "оставаться", level: "A1", aux: "sein", praeteritum: "blieb", partizip: "geblieben" },
  { infinitive: "stehen", translation: "стоять", level: "A1", aux: "haben", praeteritum: "stand", partizip: "gestanden" },
  { infinitive: "liegen", translation: "лежать", level: "A1", aux: "haben", praeteritum: "lag", partizip: "gelegen" },
  { infinitive: "sitzen", translation: "сидеть", level: "A1", aux: "haben", praeteritum: "saß", partizip: "gesessen" },
  { infinitive: "tun", translation: "делать", level: "A2", aux: "haben", praeteritum: "tat", partizip: "getan" },
  { infinitive: "rufen", translation: "звать", level: "A2", aux: "haben", praeteritum: "rief", partizip: "gerufen" },
  { infinitive: "fliegen", translation: "летать", level: "A2", aux: "sein", praeteritum: "flog", partizip: "geflogen" },
  { infinitive: "schwimmen", translation: "плавать", level: "A2", aux: "sein", praeteritum: "schwamm", partizip: "geschwommen" },
  { infinitive: "singen", translation: "петь", level: "A2", aux: "haben", praeteritum: "sang", partizip: "gesungen" },
  { infinitive: "springen", translation: "прыгать", level: "A2", aux: "sein", praeteritum: "sprang", partizip: "gesprungen" },
  { infinitive: "beginnen", translation: "начинать", level: "A2", aux: "haben", praeteritum: "begann", partizip: "begonnen" },
  { infinitive: "gewinnen", translation: "выигрывать", level: "B1", aux: "haben", praeteritum: "gewann", partizip: "gewonnen" },
  { infinitive: "verlieren", translation: "терять", level: "A2", aux: "haben", praeteritum: "verlor", partizip: "verloren" },
  { infinitive: "schließen", translation: "закрывать", level: "A2", aux: "haben", praeteritum: "schloss", partizip: "geschlossen" },
  { infinitive: "ziehen", translation: "тянуть", level: "B1", aux: "haben", praeteritum: "zog", partizip: "gezogen" },
  { infinitive: "bitten", translation: "просить", level: "B1", aux: "haben", praeteritum: "bat", partizip: "gebeten" },
  { infinitive: "steigen", translation: "подниматься", level: "B1", aux: "sein", praeteritum: "stieg", partizip: "gestiegen" },
  { infinitive: "scheinen", translation: "светить, казаться", level: "B1", aux: "haben", praeteritum: "schien", partizip: "geschienen" },
  { infinitive: "bieten", translation: "предлагать", level: "B1", aux: "haben", praeteritum: "bot", partizip: "geboten" },
  { infinitive: "schneiden", translation: "резать", level: "B1", aux: "haben", praeteritum: "schnitt", partizip: "geschnitten" },
  { infinitive: "leiden", translation: "страдать", level: "B1", aux: "haben", praeteritum: "litt", partizip: "gelitten" },
  { infinitive: "streiten", translation: "спорить", level: "B1", aux: "haben", praeteritum: "stritt", partizip: "gestritten" },
  { infinitive: "verstehen", translation: "понимать", level: "A1", aux: "haben", praeteritum: "verstand", partizip: "verstanden" },
  { infinitive: "entscheiden", translation: "решать", level: "B1", aux: "haben", praeteritum: "entschied", partizip: "entschieden" },
  { infinitive: "vergleichen", translation: "сравнивать", level: "B1", aux: "haben", praeteritum: "verglich", partizip: "verglichen" },

  /* ---------- mixed verbs: weak endings on a changed stem ---------- */
  { infinitive: "denken", translation: "думать", level: "A2", aux: "haben", praeteritum: "dachte", partizip: "gedacht" },
  { infinitive: "bringen", translation: "приносить", level: "A2", aux: "haben", praeteritum: "brachte", partizip: "gebracht" },
  { infinitive: "kennen", translation: "знать, быть знакомым", level: "A1", aux: "haben", praeteritum: "kannte", partizip: "gekannt" },
  { infinitive: "nennen", translation: "называть", level: "B1", aux: "haben", praeteritum: "nannte", partizip: "genannt" },
  { infinitive: "rennen", translation: "мчаться", level: "B1", aux: "sein", praeteritum: "rannte", partizip: "gerannt" },
  { infinitive: "brennen", translation: "гореть", level: "B1", aux: "haben", praeteritum: "brannte", partizip: "gebrannt" },

  /* ---------- separable verbs ---------- */
  { infinitive: "aufstehen", translation: "вставать", level: "A1", aux: "sein", separable: "auf", praeteritum: "stand", partizip: "aufgestanden" },
  { infinitive: "anfangen", translation: "начинать", level: "A1", aux: "haben", separable: "an", present: { du: "fängst", er: "fängt" }, praeteritum: "fing", partizip: "angefangen" },
  { infinitive: "anrufen", translation: "звонить по телефону", level: "A1", aux: "haben", separable: "an", praeteritum: "rief", partizip: "angerufen" },
  { infinitive: "ankommen", translation: "прибывать", level: "A1", aux: "sein", separable: "an", praeteritum: "kam", partizip: "angekommen" },
  { infinitive: "einkaufen", translation: "делать покупки", level: "A1", aux: "haben", separable: "ein", partizip: "eingekauft" },
  { infinitive: "aufmachen", translation: "открывать", level: "A1", aux: "haben", separable: "auf", partizip: "aufgemacht" },
  { infinitive: "zumachen", translation: "закрывать", level: "A1", aux: "haben", separable: "zu", partizip: "zugemacht" },
  { infinitive: "mitbringen", translation: "приносить с собой", level: "A2", aux: "haben", separable: "mit", praeteritum: "brachte", partizip: "mitgebracht" },
  { infinitive: "mitnehmen", translation: "брать с собой", level: "A2", aux: "haben", separable: "mit", present: { du: "nimmst", er: "nimmt" }, praeteritum: "nahm", partizip: "mitgenommen", imperativDu: "nimm" },
  { infinitive: "abfahren", translation: "отправляться", level: "A2", aux: "sein", separable: "ab", present: { du: "fährst", er: "fährt" }, praeteritum: "fuhr", partizip: "abgefahren" },
  { infinitive: "aussehen", translation: "выглядеть", level: "A2", aux: "haben", separable: "aus", present: { du: "siehst", er: "sieht" }, praeteritum: "sah", partizip: "ausgesehen", imperativDu: "sieh" },
  { infinitive: "einladen", translation: "приглашать", level: "A2", aux: "haben", separable: "ein", present: { du: "lädst", er: "lädt" }, praeteritum: "lud", partizip: "eingeladen" },
  { infinitive: "umziehen", translation: "переезжать", level: "A2", aux: "sein", separable: "um", praeteritum: "zog", partizip: "umgezogen" },
  { infinitive: "vorstellen", translation: "представлять", level: "A2", aux: "haben", separable: "vor", partizip: "vorgestellt" },
  { infinitive: "teilnehmen", translation: "участвовать", level: "B1", aux: "haben", separable: "teil", present: { du: "nimmst", er: "nimmt" }, praeteritum: "nahm", partizip: "teilgenommen", imperativDu: "nimm" },
  { infinitive: "zurückkommen", translation: "возвращаться", level: "A2", aux: "sein", separable: "zurück", praeteritum: "kam", partizip: "zurückgekommen" },
  { infinitive: "stattfinden", translation: "состояться", level: "B1", aux: "haben", separable: "statt", praeteritum: "fand", partizip: "stattgefunden", noImperative: true },

  /* ---------- inseparable and -ieren verbs: no ge- in the Partizip ---------- */
  { infinitive: "besuchen", translation: "посещать", level: "A1", aux: "haben", partizip: "besucht" },
  { infinitive: "bezahlen", translation: "платить", level: "A1", aux: "haben", partizip: "bezahlt" },
  { infinitive: "verkaufen", translation: "продавать", level: "A1", aux: "haben", partizip: "verkauft" },
  { infinitive: "erklären", translation: "объяснять", level: "A2", aux: "haben", partizip: "erklärt" },
  { infinitive: "erzählen", translation: "рассказывать", level: "A2", aux: "haben", partizip: "erzählt" },
  { infinitive: "verdienen", translation: "зарабатывать", level: "A2", aux: "haben", partizip: "verdient" },
  { infinitive: "benutzen", translation: "использовать", level: "A2", aux: "haben", partizip: "benutzt" },
  { infinitive: "bestellen", translation: "заказывать", level: "A1", aux: "haben", partizip: "bestellt" },
  { infinitive: "versuchen", translation: "пытаться", level: "B1", aux: "haben", partizip: "versucht" },
  { infinitive: "wiederholen", translation: "повторять", level: "A2", aux: "haben", partizip: "wiederholt" },
  { infinitive: "studieren", translation: "учиться в вузе", level: "A1", aux: "haben", partizip: "studiert" },
  { infinitive: "telefonieren", translation: "говорить по телефону", level: "A1", aux: "haben", partizip: "telefoniert" },
  { infinitive: "passieren", translation: "случаться", level: "A2", aux: "sein", partizip: "passiert", noImperative: true },
  { infinitive: "reparieren", translation: "чинить", level: "A2", aux: "haben", partizip: "repariert" },
  { infinitive: "funktionieren", translation: "работать (об устройстве)", level: "B1", aux: "haben", partizip: "funktioniert", noImperative: true },
  { infinitive: "entwickeln", translation: "развивать", level: "B1", aux: "haben", partizip: "entwickelt" },

  /* ---------- weak verbs, where the rules are the whole truth ---------- */
  { infinitive: "machen", translation: "делать", level: "A1", aux: "haben", partizip: "gemacht" },
  { infinitive: "sagen", translation: "говорить, сказать", level: "A1", aux: "haben", partizip: "gesagt" },
  { infinitive: "fragen", translation: "спрашивать", level: "A1", aux: "haben", partizip: "gefragt" },
  { infinitive: "lernen", translation: "учить", level: "A1", aux: "haben", partizip: "gelernt" },
  { infinitive: "wohnen", translation: "жить, проживать", level: "A1", aux: "haben", partizip: "gewohnt" },
  { infinitive: "leben", translation: "жить", level: "A1", aux: "haben", partizip: "gelebt" },
  { infinitive: "spielen", translation: "играть", level: "A1", aux: "haben", partizip: "gespielt" },
  { infinitive: "kaufen", translation: "покупать", level: "A1", aux: "haben", partizip: "gekauft" },
  { infinitive: "hören", translation: "слышать, слушать", level: "A1", aux: "haben", partizip: "gehört" },
  { infinitive: "suchen", translation: "искать", level: "A1", aux: "haben", partizip: "gesucht" },
  { infinitive: "brauchen", translation: "нуждаться", level: "A1", aux: "haben", partizip: "gebraucht" },
  { infinitive: "kochen", translation: "готовить", level: "A1", aux: "haben", partizip: "gekocht" },
  { infinitive: "lieben", translation: "любить", level: "A1", aux: "haben", partizip: "geliebt" },
  { infinitive: "lachen", translation: "смеяться", level: "A2", aux: "haben", partizip: "gelacht" },
  { infinitive: "zeigen", translation: "показывать", level: "A2", aux: "haben", partizip: "gezeigt" },
  { infinitive: "glauben", translation: "верить, полагать", level: "A2", aux: "haben", partizip: "geglaubt" },
  { infinitive: "arbeiten", translation: "работать", level: "A1", aux: "haben", partizip: "gearbeitet" },
  { infinitive: "warten", translation: "ждать", level: "A1", aux: "haben", partizip: "gewartet" },
  { infinitive: "antworten", translation: "отвечать", level: "A1", aux: "haben", partizip: "geantwortet" },
  { infinitive: "reden", translation: "говорить, беседовать", level: "A2", aux: "haben", partizip: "geredet" },
  { infinitive: "öffnen", translation: "открывать", level: "A2", aux: "haben", partizip: "geöffnet" },
  { infinitive: "rechnen", translation: "считать, рассчитывать", level: "B1", aux: "haben", partizip: "gerechnet" },
  { infinitive: "atmen", translation: "дышать", level: "B1", aux: "haben", partizip: "geatmet" },
  { infinitive: "tanzen", translation: "танцевать", level: "A1", aux: "haben", partizip: "getanzt" },
  { infinitive: "reisen", translation: "путешествовать", level: "A2", aux: "sein", partizip: "gereist" },
  { infinitive: "putzen", translation: "чистить, мыть", level: "A1", aux: "haben", partizip: "geputzt" },
  { infinitive: "sammeln", translation: "собирать", level: "A2", aux: "haben", partizip: "gesammelt" },
  { infinitive: "lächeln", translation: "улыбаться", level: "A2", aux: "haben", partizip: "gelächelt" },
  { infinitive: "ändern", translation: "менять", level: "A2", aux: "haben", partizip: "geändert" },
]
