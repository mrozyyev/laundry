# Laundry room

A one-machine status board for a shared laundry room. It answers exactly one question:
**is the washer free right now, and if not, when will it be?**

No accounts. No names. No "start wash" button that people will forget to press.

## The model: report what you saw

The app is not a tracker. It is a **crowd-sourced observation log**. The person who starts a
wash never has to interact with it. Instead, whoever walks into the room updates it — they are
motivated, because they either want the machine or they are the one who needs to know when it
will be free.

Three taps exist:

| Button | Meaning |
| --- | --- |
| **Running — how long is left?** | Read the remaining minutes off the machine display. |
| **Finished — clothes still inside** | Starts the public overdue timer. |
| **Free / empty right now** | Confirms the machine is available. |

Plus one shortcut: **Still running — confirm**, which refreshes the estimate in one tap.

Every state carries its own confidence. The app never claims to know something it was not told:

| State | How it is produced |
| --- | --- |
| `running` | Latest report says running with N minutes left, ETA still in the future. |
| `likely_free` | ETA passed, but nobody has looked. Shown as "should be free", never "free". |
| `free` | Someone confirmed it empty. Ages into "nobody has checked since". |
| `clothes_inside` | Someone saw finished laundry. Counts up as **"at least N min"** because the true finish time is unknown. |
| `unknown` | No report since the room opened. Also carries yesterday's late clothes into the morning. |
| `closed` | Outside 7:00–14:30 Mon–Thu / 7:00–12:00 Fri, Europe/Bucharest. |

Rules baked in:

- A running cycle that would end after closing time triggers a warning: *"won't finish before
  the room closes — clothes will be locked in overnight."*
- Notifications are only sent while the room is open.
- "Free" is never inferred from silence. Silence means `unknown` or `likely_free`.
- If yesterday ended with clothes left inside, the next morning still warns you before you start
  a wash on top of them.

## Notifications

Web Push with VAPID, via a service worker. Two events:

1. **Machine is free** — sent when someone confirms it empty (deduped for 10 minutes), or when a
   reported cycle's ETA passes with no newer report ("should be free, unconfirmed").
2. **Clothes still inside** — sent 30 minutes after a "finished, clothes inside" report, once.

iPhone caveat: Safari only delivers web push to an **installed PWA** (Share → Add to Home
Screen, iOS 16.4+). The page detects this and says so. Android works from the browser.

## Development

```bash
npm install
cp .env.example .env
npm run vapid          # copy the two keys into .env
npm run dev            # http://localhost:4321
```

`npm run check` typechecks, `npm run build` produces a Node standalone server, `npm start` runs it.

Environment:

| Variable | Purpose |
| --- | --- |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Required for push. `npm run vapid` generates them. |
| `VAPID_SUBJECT` | `mailto:` or URL identifying the operator. |
| `DB_PATH` | SQLite file. Defaults to `./data/laundry.db`. |
| `TZ_NAME` | Schedule timezone. Defaults to `Europe/Bucharest`. |

The built-in ticker runs every 60 seconds from `src/middleware.ts`. On a platform without
long-lived processes, disable that and call `POST /api/tick` from cron every minute instead.

Push requires HTTPS (except on `localhost`).

### Static preview (GitHub Pages)

The full app needs a Node process for SQLite, the API and push, so GitHub Pages cannot run it.
The repo ships a **static preview** instead: `npm run build:preview` builds `src-preview/` into
`dist-preview/` under the `/laundry` base path. The buttons work locally, but nothing is saved and
no notifications are sent — the page says so.

The `.github/workflows/pages.yml` workflow publishes that preview on every push to `main`.
`ci.yml` runs `astro check` and the real server build.

## Machine reference: Beko B300 9 kg

Reference durations for the 9 kg Beko platform at 1200–1400 rpm, from Beko's official programme
and consumption table. Use them to sanity-check a report; the display is always the better source.

| Programme | Load | Duration |
| --- | --- | --- |
| Eco 40-60 | 9 kg | 3 h 48 min |
| Eco 40-60 | 4.5 kg | 2 h 53 min |
| Eco 40-60 | 2.5 kg | 2 h 53 min |
| Cottons 20 °C | 9 kg | 3 h 40 min |
| Cottons 60 °C | 9 kg | 3 h 40 min |
| Cottons 20 °C | 4.5 kg | 1 h 35 min |
| Synthetics 40 °C | 4 kg | 2 h 05 min |
| Xpress 28'/14' | 9 kg | 28 min |
| Xpress 28'/14' (rapid, ≤2 kg) | 2 kg | 14 min |

Durations vary slightly between the 1200 and 1400 rpm variants of the same platform; the machine
display is authoritative.

Machine behaviours that matter for this app:

- The remaining time is shown on the display while the cycle runs.
- Cottons and Eco start with a **half-load estimate**. After 20–25 minutes the machine detects the
  real load and the remaining time can grow — the manual warns the difference can reach 1–1.5
  hours. Early readings are rough; readings after ~25 minutes are good.
- **The display goes dark 10 minutes after the cycle ends.** A later visitor cannot read a
  remaining time. If the door opens and the drum has clothes, report "finished — clothes inside".
- The door unlocks when the program ends.
- Avoid Rinse Hold (keep-rinse-water) in a shared machine: the program never completes and the
  door stays locked.

## House rule

Finished + clothes inside means the next person may move them to the basket. The overdue timer is
public; identity is not. That is the whole enforcement mechanism — keep it that way.

## Print a QR code

Generate a QR pointing at the deployed URL and stick it on the machine door. One scan → three
buttons, no typing, no login.
