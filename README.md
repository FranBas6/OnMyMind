<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/logos/png/onmymind-logo-dark.png" />
    <img src="public/logos/png/onmymind-logo.png" alt="OnMyMind" width="420" />
  </picture>
</p>

<p align="center">
  <b>Get it out of your head.</b><br />
  A list app to jot down whatever is on your mind in seconds (tasks, shopping, events and notes)
  and find it again when you need it.
</p>

<p align="center">
  <b>English</b> · <a href="README.es.md">Español</a>
</p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-5A4BE6?style=flat-square&logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-5A4BE6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-5A4BE6?style=flat-square&logo=supabase&logoColor=white" />
  <img alt="PWA" src="https://img.shields.io/badge/PWA-offline%20first-5A4BE6?style=flat-square&logo=pwa&logoColor=white" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-1%2C490%2B-5A4BE6?style=flat-square&logo=vitest&logoColor=white" />
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/readme/movil-inicio-oscuro.png" />
    <img src=".github/readme/movil-inicio-claro.png" alt="Home: the inbox and the lists, each with its own icon" width="200" />
  </picture>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/readme/movil-compras-oscuro.png" />
    <img src=".github/readme/movil-compras-claro.png" alt="A shopping list with its total and a price drop" width="200" />
  </picture>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/readme/movil-hoy-oscuro.png" />
    <img src=".github/readme/movil-hoy-claro.png" alt="Today: what is due across every list" width="200" />
  </picture>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/readme/movil-captura-oscuro.png" />
    <img src=".github/readme/movil-captura-claro.png" alt="Quick capture understanding «the Friday at 9pm»" width="200" />
  </picture>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/readme/escritorio-compras-oscuro.png" />
    <img src=".github/readme/escritorio-compras-claro.png" alt="Desktop: sidebar, a list and a product with six months of price history" width="860" />
  </picture>
</p>

## What it is

Most to-do apps make you decide where something goes before you can write it down. OnMyMind does
it the other way round: you capture first, in a couple of seconds, and organise later, if you
want to. It is a mobile-first web app that installs like a native one, works without a
connection, and grew from a simple inbox into lists that hold notes, tasks, purchases and events
side by side. The app is in Spanish; it is the one I use every day.

## Features

- ⚡ **Capture in seconds.** The + on the phone or ⌘⇧Space on the computer, straight into the
  inbox. It understands written dates («Cena con Marta el viernes a las 21h»), a pasted list
  becomes one item per line, and anything shared from another app is saved too.
- 🗂️ **Lists that hold anything.** A list has no fixed type: notes, tasks, purchases and events
  live together, with sublists inside. Each list has its colour and an icon or emoji. To decide
  between options, a «pick one» sublist with a side-by-side «Compare» view.
- 🛒 **Purchases with prices.** The price is read from the shop page when you paste the link, a
  product can have several shops, and the list adds it all up. Every morning prices are checked
  again on their own, the history is kept and you get a notification when one drops.
- 📅 **Today and the agenda.** What is due today across every list, any other day through its
  calendar, custom repeats, reminders and a morning summary. Events can also be subscribed to
  from the iPhone Calendar or Google Calendar.
- 👥 **Live sharing.** A list is shared with a link, and what the other person does shows up
  instantly, with their initial on what they add or complete.
- 🔒 **Private things.** A private key that opens with Face ID, a fingerprint or Touch ID. With
  it, protected notes encrypted on the device (the Wi-Fi password, the alarm code) and hidden
  lists that do not show up anywhere until unlocked.
- 📴 **Works offline.** It installs as an app, opens instantly with what is cached, and changes
  made without a connection are sent, in order, when it comes back.

## Technical highlights

- **Offline first, for real.** The TanStack Query cache is persisted to IndexedDB, and every
  write that can wait goes through a durable mutation queue that survives closing the app and is
  replayed in order when the connection returns. Optimistic updates everywhere, with rollback.
- **Security in the database, not in the client.** Row Level Security on every table, with the
  sharing rules (who sees a list, who can change the list itself and who can only work with what
  is inside it) enforced in PostgreSQL and covered by pgTAP tests. A strict Content Security Policy with no third-party
  scripts.
- **Client-side encryption.** Protected notes are encrypted with AES-GCM before they leave the
  device. The vault key is wrapped with PBKDF2 (600,000 iterations) from the private key, and
  with the WebAuthn PRF extension so Face ID can unlock it. The database only ever sees
  ciphertext; decrypted text lives in memory and is dropped when the app locks.
- **Real-time without leaks.** Changes are broadcast from the database to a private channel per
  user, carrying ids only; each client refetches what it can see, so RLS still decides.
- **Prices that update themselves.** A scheduled Edge Function (`pg_cron`) reads product pages
  in layers (JSON-LD, product and Open Graph meta tags, microdata), stores the history and sends Web Push
  notifications (VAPID) when a price drops.
- **Dates and repeats.** An in-house Spanish natural-language date parser that declines when it
  is unsure, and recurrence rules (RRULE) computed identically in TypeScript and SQL, checked
  against a shared set of cases.

## How I work

- **Concept before code.** The product is written down first: features, data model,
  architecture and design system. Then each phase is planned in small sessions, each with its
  goal, the files it touches and a verification checklist that has to be met before closing it.
- **Design before code.** Every screen is designed first, as a design system with tokens tuned
  for WCAG AA contrast. Anything the design does not cover is decided explicitly and written
  down, never improvised in the code.
- **Decisions on record.** Architecture decisions are written as ADRs (13 so far): from
  Supabase vs Firebase and PWA vs native to the threat model of the private features.
- **Small, verified changes.** One branch per task, squashed into `develop`, with `main` only
  moving forward by fast-forward. A pre-push hook runs the type check, Deno checks for the Edge
  Functions, lint with zero warnings and the whole test suite: nothing red gets pushed.
- **Tested at every level.** Over 1,140 app tests (Vitest and Testing Library, written from the
  user's point of view), over 350 database tests (pgTAP) for RLS and SQL functions, and an
  end-to-end pass in a real browser, CSP included, before a session is closed. Every database
  change is a migration with its own tests.
- **Tools.** Besides the usual ones, I use AI assistants (Claude Code and Claude Design) to
  speed up implementation and design iterations, always within the plans, rules and checks
  above.

### By the numbers

| Phases | ADRs | Migrations | Design iterations | App tests | Database tests |
| :----: | :--: | :--------: | :---------------: | :-------: | :------------: |
|   5    |  13  |     31     |        28         |   1,143   |      352       |

## Tech stack

| Layer     | Technology                                                                       |
| --------- | -------------------------------------------------------------------------------- |
| Front end | React 19, TypeScript (strict), Vite, TanStack Router and TanStack Query          |
| UI        | Tailwind CSS 4, shadcn/ui and Radix, lucide icons, Recharts, dnd-kit             |
| Back end  | Supabase: PostgreSQL with RLS, Auth, Storage, Realtime and Edge Functions (Deno) |
| App       | PWA with its own service worker, IndexedDB cache, Web Push, WebAuthn             |
| Quality   | Vitest, Testing Library, pgTAP, ESLint (type-checked), Prettier, Husky           |

---

More about this project and my other work on my portfolio: [franbasguil.netlify.app](https://franbasguil.netlify.app/en/projects/onmymind/)
