# Casacast — real-estate multipublisher

A back office for a (fictional) Costa Blanca estate agency. An agent enters a listing once, and it
goes out to every channel the agency uses: its own website, a Kyero XML feed that portals such as
Idealista pull from, and a Telegram channel.

**The problem it solves:** small agencies retype the same listing on three to five sites. Descriptions
drift apart, and a flat sold last week is still advertised somewhere.

**Live demo:** https://casacast-demo.vercel.app — the public site in Spanish, English and Ukrainian,
and the back office at `/login` (press **Try the demo**).

## Try the demo

Every visitor who presses **Try the demo** gets a sandbox of their own: no password, up to 10
listings with up to 10 photos each, and everything is deleted every night. What you create is
visible only to you, on the public site too (tagged **Demo** in the catalogue), and never to other
visitors, search engines or the public Kyero feed.

| In the hosted demo | What happens                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Agency website     | Real: publish a listing and open it on the site (only you see it)                                         |
| Kyero XML feed     | Real validation and XML; your listings are in your own feed, `/feeds/kyero-preview.xml`                   |
| Telegram           | Simulated through the real queue: the panel goes "Syncing…" → "Published", nothing is sent to Telegram    |
| Partner portal     | A mock API with latency and random failures, to show retries                                              |
| Enquiries          | Send the form on any listing or the contact page and it arrives in your sandbox's back office             |
| Email replies      | Shown in the conversation, marked "not emailed"                                                           |
| Admin sign-in      | Shown but switched off. [Run it locally](#running-it-locally) to sign in as admin with everything enabled |

Photos you upload stay in the demo's database (re-encoded as JPEG), never in a third-party store,
and per-connection and daily limits keep the free hosting tiers safe.

## How publishing works

Each listing has one row per channel in `publications`: is it wanted there (`enabled`), and where it
stands (`queued` → `published` | `failed`, `removed` once taken down). Saving a listing, changing its
photos, ticking a channel or pressing **Retry** marks the rows `queued`.

```
 save / tick / retry ──► publications (status = queued) ──► worker ──► adapter ──► channel
                                                             │
                              sync_logs ◄── one row per attempt (action, result, error, duration)
```

- **One interface per channel.** `ChannelAdapter` has `publish`, `update` and `unpublish`
  (`src/lib/publishing/types.ts`). The site, the Kyero feed, Telegram and the mock portal each
  implement it; the registry is a `Record<ChannelType, ChannelAdapter>`, so adding a channel without
  an adapter doesn't compile. Nothing else changes for a new channel.
- **The queue stores "needs a sync", not "publish".** The worker decides the action when it runs, from
  what is wanted now (enabled, listing active) and what the channel has (`externalId`). Publishing and
  withdrawing before the worker gets there makes no call at all, and running a sync twice is harmless
  (`src/lib/publishing/plan.ts`).
- **No double posts with several workers.** Jobs are claimed with `FOR UPDATE SKIP LOCKED` and a
  60-second lease. If the listing changes while a sync is running, the row stays queued and syncs
  again with the new data. An integration test runs three workers at once against Postgres.
- **Retries where they help, not where they don't.** Adapters throw `ChannelError` with
  `retryable`: timeouts, 5xx and rate limits back off 10 s, 30 s, 90 s (or Telegram's
  `retry_after`), then show **Failed** with a Retry button; bad data and configuration fail at once
  with a message saying what to fix.
- **Local channels are synchronous, remote ones are queued.** The site and the feed only touch our
  database, so they sync inside the save and the page shows the result straight away. Telegram and
  the portal run in `after()` once the response is sent. There's no worker process to host: the admin
  page polls while something is queued and each poll runs the due jobs; `/api/cron/worker` does
  the same on a schedule.
- **Sold is not the same as withdrawn.** A sold listing leaves every channel, but its site page stays
  (with a notice) and its Telegram post is edited to "SOLD" rather than deleted. A withdrawn one is
  removed everywhere.
- **The site is a channel too.** The public catalogue shows active listings whose site publication is
  `published`, so unticking "Agency website" hides a listing from the site.

| Channel        | How it publishes                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agency website | A row in our database; the catalogue reads it                                                                                                      |
| Kyero XML feed | Checked against Kyero's rules, then listed in `/feeds/kyero.xml` (Kyero v3); portals pull it. Tests validate the feed against Kyero's official XSD |
| Telegram       | Bot API: photo post with caption and link; edited on update, marked "SOLD" when sold. Simulated for demo sandboxes                                 |
| Partner portal | A mock API with latency, random 503s and timeouts, and a 422 for short descriptions, to exercise retries                                           |

The Kyero feed follows Kyero's published V3 schema and notes, kept in
`src/lib/publishing/kyero-spec/`: every test run validates generated feeds (and Kyero's own sample)
against the XSD. Photos are offered as JPG, which Cloudinary converts on the fly, because Kyero
doesn't read WebP; line breaks are `&#13;`; and the `<date>` moves whenever photos change, since
portals only re-read listings whose date changed.

Idealista and Fotocasa don't offer a public "publish a listing" API; agencies reach them through XML
feeds like Kyero's. The mock portal shows where a real partner API would plug in.

## Email conversations

Agents answer enquiries from the back office, and clients' replies come back into the same
conversation. It runs on an ordinary mailbox (Gmail with an app password), no domain needed.

```
 enquiry form ──► leads
 agent replies ──► SMTP ──► client      From: agency@gmail.com
                                        Reply-To: agency+lead-<token>@gmail.com
 client replies ──► agency inbox ──► IMAP sync ──► lead_messages (only the new text)
```

- **Replies find their enquiry by the address.** Gmail delivers `agency+anything@gmail.com` to the
  same mailbox but keeps the address on the email, so a token there survives every mail client.
  `In-Reply-To` / `References` matching our Message-IDs is the fallback. Other mail is left alone.
- **Polling, because serverless can't wait.** Being told about new mail needs a connection held
  open, which a serverless function can't do. The enquiry pages check the inbox every 15–30 s while
  open, and `/api/cron/worker` does it on a schedule.
- **Read once, by cursor.** IMAP UIDs only grow (per UIDVALIDITY): the last one seen is stored,
  with a lease so two syncs never overlap, and the Message-ID is unique as a second guard. The
  cursor moves only after an email is filed, so a database error retries it.
- **Nothing typed is lost.** A reply is stored first, then sent; a failure keeps the text with the
  server's error and a Retry button.
- **The demo never sends email.** Sandboxes' replies show in the conversation marked "not emailed".
  Otherwise anyone could type someone's address into the form and send mail from the agency. The
  admin, running locally with a mailbox configured, sends real email.

Tested end to end against local SMTP and IMAP servers: the email that goes out, a reply matched by
the address, one matched by headers only, unrelated mail ignored, nothing imported twice.

## Stack

| Concern    | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Cache Components), TypeScript strict  |
| Database   | PostgreSQL (Neon in production), Drizzle ORM                  |
| Auth       | Signed session cookie (`jose`), bcrypt for the admin          |
| Validation | Zod, shared by the forms and the Server Actions               |
| UI         | Tailwind CSS v4, self-hosted Geist                            |
| Photos     | Cloudinary for the admin, Postgres for demo sandboxes         |
| i18n       | `[locale]` root layout, typed dictionaries, `Intl` formatting |
| Maps       | Leaflet + OpenStreetMap tiles, no API key                     |
| Tests / CI | Vitest, GitHub Actions on a real Postgres service             |

## Decisions worth explaining

- **Drizzle instead of Prisma.** SQL-first, no code generation step and no native engine binary, so
  migrations run the same on a laptop, in CI and on Vercel.
- **Own session instead of Auth.js.** There is one admin and anonymous demo sandboxes, no OAuth. A
  signed cookie plus a Data Access Layer (`src/lib/auth/dal.ts`) is the pattern the Next.js docs
  recommend, and every line of it can be explained.
- **Authorization lives next to the data.** `src/proxy.ts` only redirects anonymous visitors. Every
  Server Component and Server Action re-checks the user through the DAL, so a hand-crafted request
  can't skip the rules.
- **All limits in one place.** `src/lib/permissions.ts` holds who can edit what and how many listings
  the demo may create. Paid plans, if this ever became a product, would be more rows in the same
  table.
- **Validation reports everything at once.** Cross-field rules (coordinates, half-filled
  translations) run outside the Zod schema, because refinements are skipped once any field fails.
  A regression test pins this down.
- **Photos are shrunk in the browser.** Phone photos are 5–10 MB; the page resizes them to 2000 px
  WebP (JPEG where the browser can't encode WebP) before upload, so requests stay well under the
  Server Action body limit and uploads are quick on mobile data.
- **The server trusts bytes, not names.** Uploads are checked by reading the image header
  (`image-size`): file names and browser-reported MIME types are ignored.
- **One cover per listing, guaranteed by Postgres.** A partial unique index allows a single
  `is_cover` row per listing, and photo changes lock the listing row so parallel uploads can't race.
- **Storage is swappable.** `src/lib/storage` has one interface with two implementations:
  Cloudinary, or a local `.uploads/` folder when the keys aren't set, so the project runs with no
  accounts at all.
- **Each language has its own root layout.** The site sits under `app/[locale]` and the back office
  in `app/(back)`, so `<html lang>` is right on every page and any Server Component reads the
  language with `next/root-params`. Dictionaries are plain TypeScript objects: a missing translation
  key is a type error, and Ukrainian gets its three plural forms through `Intl.PluralRules`.
- **The catalogue is cached and the back office expires it.** Public queries use `use cache` with a
  `listings` tag; every admin change to a listing or photo calls `updateTag`, so the site serves from
  cache and still shows an edit on the next request.
- **Filters are the URL.** The search form is a plain GET form (`next/form`): it works without
  JavaScript, every search is a shareable link, and malformed parameters are ignored, not errors.
- **One URL per home.** Listing URLs are `/en/homes/cb-0001-bright-flat-…`; only the reference
  matters, and any other slug redirects to the current one. Sold homes keep their page (marked
  `noindex`) so old links don't break; drafts are a 404.
- **Two palettes, one set of tokens.** The back office is cool blue; the public site is cream and
  terracotta. Components only use tokens like `bg-accent`, and `.theme-site` on the site's `<html>`
  redefines them, so the same components look right in both.
- **The banner photo comes from the listings.** The home page banner uses the cover of the agency's
  most expensive home, so uploading a good photo in the back office changes the banner.
- **Two headers, chosen by the route tree.** The home page draws a transparent header over its
  banner; every other page sits in the `(pages)` route group, whose layout draws the solid sticky
  one. No pathname checks or CSS tricks, so it stays right when Next.js keeps the previous page
  hidden in the DOM during client-side navigation.
- **A map that survives navigation.** Plain Leaflet created in an effect and removed in its cleanup,
  so it rebuilds cleanly when you go Back to a page Next.js had kept hidden.
- **Location without the address.** The map draws a 400 m circle, not a pin, as agencies do before a
  viewing.
- **A sandbox per visitor.** Anyone can open the demo, so nothing one visitor does may reach
  another, the public site or a real channel. Each "Try the demo" creates a demo user of its own;
  its listings, photos and enquiries are visible to it only (`src/demo/visibility.ts`, mirrored in
  the SQL), Telegram is simulated, and a nightly cron deletes every sandbox.
- **The demo is a layer, not a fork.** Everything demo-specific lives in `src/demo/`, with its own
  tables and migrations (`drizzle-demo/`, tracked separately), so the product's code and migrations
  stay as they are.
- **Enquiries without a CAPTCHA.** A hidden honeypot field catches simple bots; consent to store the
  details is a required checkbox.
- **Reference numbers can't collide.** New listings get `CB-0011`, `CB-0012`… inside a transaction
  guarded by a Postgres advisory lock, so two saves at the same moment never take the same number.

## Running it locally

Locally the project runs with everything: sign in as admin, post to a real Telegram channel, store
photos in Cloudinary and answer enquiries by email. Each integration is optional and switched on by
its variables in `.env`.

Requirements: Node 22+, Docker (or any Postgres 16).

```bash
cp .env.example .env            # then fill in the values below
docker compose up -d            # local Postgres on :5432
npm install
npm run db:migrate
npm run db:seed                 # 4 channels and the agency's 10 listings
npm run dev
```

Open http://localhost:3000 for the site and http://localhost:3000/login for the back office.

| Variables                                                              | What they switch on                                                                                            |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`, `SESSION_SECRET`                                       | Required. The default `DATABASE_URL` matches `docker compose`; the secret is `openssl rand -base64 32`         |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`                                        | Admin sign-in with these credentials: full rights over every listing. No re-seeding needed                     |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`                               | Real posts for the agency's listings (the admin's). Create the bot with @BotFather and make it a channel admin |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | The admin's photos in Cloudinary; without them they go to a local `.uploads/` folder                           |
| `MAIL_ADDRESS`, `MAIL_APP_PASSWORD`                                    | Email replies from the back office and client replies back in it (a Gmail app password)                        |
| `CRON_SECRET`                                                          | Protects the scheduled jobs (`/api/cron/demo-reset`, `/api/cron/worker`)                                       |

Sandboxes stay sandboxes whatever is set: their Telegram posts are simulated and their replies are
never emailed. `npm test` also runs the queue's integration test when `DATABASE_URL` is set in the
environment.

**Photos for the agency's listings** ship with the repo in `public/seed/<reference>/` (`01.jpg` is
the cover); the seed adds them to listings that have none.

## Scripts

| Script                    | What it does                          |
| ------------------------- | ------------------------------------- |
| `npm run dev`             | Dev server                            |
| `npm run build` / `start` | Production build and server           |
| `npm run lint`            | ESLint                                |
| `npm run typecheck`       | Route types + `tsc --noEmit`          |
| `npm test`                | Unit tests                            |
| `npm run format`          | Prettier                              |
| `npm run db:generate`     | New migration from `src/db/schema.ts` |
| `npm run db:migrate`      | Apply migrations (product, then demo) |
| `npm run db:seed`         | Seed the agency's listings and photos |
| `npm run db:studio`       | Browse the database                   |

## Project structure

```
src/
  app/
    [locale]/         public site: root layout + footer, home page with its banner header
    [locale]/(pages)/ catalogue (/homes), listing pages, /about, /contact, with the solid header
    (back)/admin/     back office: overview, listings, photos, enquiries, publishing
    feeds/kyero.xml/  the public Kyero XML feed
    api/cron/worker/  scheduled tick: publishing retries and the inbox sync
    (back)/login/     sign-in page and auth Server Actions
    sitemap.ts        every listing in every language, with hreflang
  components/         UI primitives, admin and site building blocks
  db/                 schema, client, seed
  i18n/               locales, dictionaries, formatting
  lib/
    auth/             session token, cookies, Data Access Layer
    catalog/          public queries, filters, slugs
    leads/            enquiry queries, with the demo visibility rule
    mail/             SMTP replies, IMAP inbox sync, reply threading
    photos/           validation, ordering, URLs, browser compression
    publishing/       channel adapters, queue, sync plan, Kyero XML, Telegram
    storage/          Cloudinary and local storage behind one interface
    permissions.ts    roles and limits
  demo/               the demo layer: sandboxes, visibility, photo storage in Postgres,
                      simulated Telegram, Kyero preview feed, rate limits, nightly reset
  proxy.ts            language redirect on /, sign-in redirect for /admin
drizzle/              SQL migrations
drizzle-demo/         the demo layer's own migrations
public/seed/          photos of the agency's listings
```

## Roadmap

- [x] **Week 1** — tooling, CI, schema and seed, admin and demo sign-in, listings CRUD
- [x] Photos: drag-and-drop upload, reordering, cover image, browser-side compression
- [x] **Week 2** — public catalogue: filters, map, listing page, ES / EN / UK, SEO, enquiry form
- [x] **Week 3** — publishing module: channel adapters (site, Kyero XML, Telegram, mock portal),
      statuses and sync log with retry, "sold" unpublishes everywhere
- [x] Back office: enquiries (new / in progress / handled), email conversations, EN / UK interface
- [x] Public demo: a sandbox per visitor, nightly reset, deployment to Vercel + Neon
- [ ] Playwright end-to-end tests in CI
- [ ] Map of all listings in the catalogue
