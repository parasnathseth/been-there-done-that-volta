# Been There, Done That (Volta demo)

A standalone demo, modelled on Volta's monthly founder update. When founders mark a blocker solved, they can share what helped. When another founder reports a similar blocker, they see those stories and can reach out in one click. Every story and blocker has its own consent setting.

All people and companies come from Volta's made-up data pack (`Volta-demo-data-pack.csv`). Each person's "Lived through" item becomes a shared story and their "Stuck on" item an open blocker. The pack has no "what helped" text, emails or sharing choices, so those are invented in `data/pack-overlay.js`.

**Demo hero: Jordan Gallant** (Spatwell, Charlottetown, never comes into Volta). His "Selling to farmers through a co-op" item starts as an open blocker he can mark solved, and his "Applying for a first IRAP grant" blocker is typed live. It matches Leah Morin's grant story.

## Run it

Requirements: Node.js 22.6 or newer, and a Supabase project (PostgreSQL).

```bash
npm install
cp .env.example .env        # then paste your Supabase "Session pooler" connection string into .env
npm run db:setup            # creates the tables (safe to run again)
npm run db:seed             # loads the data pack (wipes existing demo data)
npm start                   # http://localhost:3000
```

The first run downloads the matching model (about 23 MB) into `.cache/`.

Use **View as** at the top to switch between people from the data pack (e.g. Jordan Gallant, Anjali Raman) and Laura (admin).

## What's in it

| Page | Who | What it does |
|---|---|---|
| Monthly update | Founders | Mark past blockers solved or still working on it; answer "Did a resident's story help?"; share what helped (email, anonymous or private) with a preview; report this month's blocker and choose whether to use it for matching |
| My matches | Founders | Stories that match each open blocker with matching turned on. "Write to ..." opens an editable, ready-to-send email with Open in Gmail, Open in Outlook, Open in my email app and Copy |
| My stories and blockers | Founders | Change how each story is shared, delete it, or turn matching on or off for each blocker |
| Unstuck summary | Laura | Average months to solve, blockers open, stories shared, founders who reached out to a resident, solved blockers where a story helped, and blockers reported and solved by month. Totals based on fewer than 3 founders are hidden |

**Tracking the proposal's two measures:** clicking any send option in the "Write to ..." window records that the founder reached out (which story and which option, never the message). The "Did a resident's story help?" answer is saved on the solved blocker. A click shows someone tried to reach out, not that an email was sent. The seeded clicks and answers are invented.

## How matching works

`src/embed.js` runs the free all-MiniLM-L6-v2 model on this server (no outside AI service) to turn text into 384 numbers that represent its meaning. Each story is stored with the numbers for "the problem it solved + what helped + what the author can help with". A blocker is compared with every shareable story; the closest 3 above a minimum score (0.40) are shown.

Run `npm run eval` to test matching on 43 blockers based on the data pack (`data/eval-pairs.js`), 6 of which have no fitting story. Current results at 0.40:

| Right story shown first | Right story in top 3 | No match shown when none fits |
|---|---|---|
| 76% | 84% | 67% (4 of 6) |

A lower minimum score finds more right stories but shows more wrong ones for unrelated problems. On an earlier invented data set, a larger free model (all-mpnet-base-v2, about 420 MB) did better; it can be tried by changing `MODEL_ID` in `.env` and re-running the seed.

## Consent and privacy rules (enforced on the server)

- Blockers are never shown to anyone. Their meaning-numbers are only created when the founder turns matching on, and turning it off deletes them.
- Private stories are never matched. Name, startup, email and date appear only for stories shared "with my email".
- Founders never see stories from their own startup.
- Founders can only change their own blockers and stories.
- Laura's summary is admin-only and contains totals only.
- User text is always displayed as plain text. Errors are logged without request contents.
- Row level security is on with no policies, so Supabase's public API keys can't read the tables; only this server can, with the database connection string.

## Demo only: not ready for real founder data

- **Sign-in:** "View as" sends the chosen person's id in a header. Anyone could pick anyone. Replace with portal sign-in or email-link sign-in before real use.
- **Database certificate:** the connection uses SSL but does not verify Supabase's certificate (`rejectUnauthorized: false`). Add Supabase's CA certificate for production.
- **Not hosted:** the backend runs locally; only the database is hosted.
- **Not included yet:** connecting to the real portal, notifications, rate limits on searching, reporting a story, and what happens to data when a resident leaves.

## Project layout

```
src/server.js         API routes and consent rules
src/embed.js          on-server model and similarity
src/match.js          ranking and minimum score
src/db.js             Supabase connection
src/months.js         month helpers
db/schema.sql         tables
scripts/              setup, seed and matching test
data/                 data pack loader, invented extras, test blockers
Volta-demo-data-pack.csv  made-up founders supplied by Volta
public/               the four pages (plain HTML, CSS and JavaScript)
```
