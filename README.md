# Smart Study EcoSystem

A material hub for a university department. Professors upload lecture slides,
notes and PDFs; students search the catalogue, preview documents in the browser,
print, download, and save favourites — and ask a study chatbot questions about
the uploaded material, with every answer citing the exact lecture and slide it
came from.

Built for a final year project, so it is deliberately small, readable and easy to
demonstrate, while still covering the parts that matter: authentication, roles,
file storage, document conversion, access control and retrieval-augmented AI.

## Features

- **Accounts and roles** — email and password sign-in with `ADMIN`, `PROFESSOR`
  and `STUDENT` roles. Public registration is limited to students and
  professors; administrator accounts are created from the admin panel.
- **Catalogue** — browse without an account, or filter by search text, subject,
  lecturer, file type and sort order. Filters live in the URL so a view can be
  bookmarked or shared.
- **In-browser preview** — PDFs embed directly, text formats render as sanitised
  HTML, and PowerPoint, Word and Excel files are converted to PDF on demand and
  cached so the cost is paid once.
- **Downloads and printing** — the untouched original is always what a student
  downloads. A dedicated A4 view prints the converted PDF.
- **Favourites** — students can save material to their own list.
- **Professor tools** — upload with drag and drop, edit title, description and
  subject, and delete material.
- **Admin tools** — dashboard with usage statistics, user and role management,
  account activation, and subject management.
- **Study chatbot (Ask AI)** — signed-in students ask questions in English,
  Urdu or Roman Urdu and get answers generated strictly from the uploaded
  material, with inline `[n]` references back to the exact file, slide and
  quote. Full-page `/chat` with per-student conversation history, plus a
  floating widget on every other page, and an "Ask AI" button per material
  that scopes answers to that one file.
- **Interface** — light and dark themes, responsive from phone to desktop, and
  accessible labelling and focus states throughout.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, Turbopack) |
| Language | TypeScript, strict |
| Styling | Tailwind CSS v4, shadcn/ui |
| Database | SQLite via Prisma 7 with the better-sqlite3 driver adapter |
| Auth | Hand-rolled JWT session in an httpOnly cookie, bcrypt password hashing |
| Conversion | LibreOffice headless, with a Windows Office COM fallback |
| Chatbot / embeddings | Google Gemini (Generative Language REST API) |
| Validation | Zod |

SQLite is used because it makes the project trivial to run and demo on a single
machine. The Prisma schema is written so moving to PostgreSQL is a matter of
changing the datasource and running a migration.

## Requirements

- Node.js 20 or newer
- npm
- LibreOffice, for previewing `.ppt`, `.pptx`, `.doc`, `.docx`, `.xls` and `.xlsx`
  files (optional; without it those files still download, they just cannot be
  previewed)

## Setup

```bash
npm install
```

Create `.env` in the project root:

```env
# SQLite database file. This relative URL is resolved from the project root,
# so the file lives at ./dev.db.
DATABASE_URL="file:./dev.db"

# Signs session cookies. Must be at least 16 characters. Generate one with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTH_SECRET="replace-me-with-a-long-random-string"

NEXT_PUBLIC_SITE_NAME="Smart Study EcoSystem"

# Google Gemini key for the study chatbot (embeddings + answers).
# Get a free key at https://aistudio.google.com/apikey
GEMINI_API_KEY="your-key-here"

# Optional overrides; sensible defaults are built in. Note that retired models
# such as gemini-2.5-flash are rejected on newer API keys, and the newest
# aliases (gemini-flash-latest) are often at capacity — the default
# gemini-3.5-flash responds in about two seconds on the free tier.
GEMINI_CHAT_MODEL="gemini-3.5-flash"
GEMINI_EMBED_MODEL="gemini-embedding-001"
```

Without `GEMINI_API_KEY` everything else still works; the chatbot reports that
it is not configured and indexing marks materials as failed with a clear reason.

Then create the database and the demo data:

```bash
npx prisma migrate dev    # applies prisma/migrations and creates ./dev.db
npx prisma db seed        # subjects, demo users and sample material rows
```

Start the app:

```bash
npm run dev               # http://localhost:3000
```

## Demo accounts

The seed script creates these accounts. All of them use the password
`Password123`, so change or remove them before deploying anywhere real.

| Role | Email |
| --- | --- |
| Admin | `admin@university.edu` |
| Professor | `bilal.ahmed@university.edu` |
| Professor | `ayesha.khan@university.edu` |
| Student | `ali.raza@student.university.edu` |

The seeded material rows are metadata only. They have no file on disk, so they
appear in the catalogue but cannot be downloaded. Upload a real file to exercise
the full pipeline.

## Supported uploads

Maximum size is 50 MB per file.

| Format | Preview | Download |
| --- | --- | --- |
| `.pdf` | Embedded PDF viewer | Original PDF |
| `.pptx`, `.ppt`, `.docx`, `.doc`, `.xlsx`, `.xls` | Converted to PDF, then embedded | Original file |
| `.txt`, `.md`, `.csv`, `.log` | Rendered as sanitised text | Original file |
| `.zip` | Not previewed | Original file |

## How document conversion works

Conversion is server-side, so students need nothing installed beyond a browser.

1. A professor uploads a `.pptx`. The original is written to `uploads/originals`
   under a generated UUID name and the record is saved with no preview.
2. When somebody opens the material page, the browser asks
   `POST /api/materials/[id]/preview/convert`.
3. The job is recorded in the `PreviewJob` table and picked up by a small
   in-process queue that runs at most two conversions at a time, because
   LibreOffice is CPU and memory hungry.
4. LibreOffice is invoked headless with a private profile directory per job, so
   parallel conversions cannot interfere with each other. On Windows, if
   LibreOffice is not installed, a PowerShell script drives the installed
   Microsoft Office application instead.
5. The output is checked for the `%PDF-` magic bytes, stored in
   `uploads/previews`, and the material is marked `READY`. Every later visitor
   is served the cached PDF.
6. A failure is recorded and shown in the interface, but the original file stays
   downloadable, and the job can be retried.

Job state lives in the database, so a server restart mid-conversion is
recoverable. `src/instrumentation.ts` re-queues any job left `RUNNING` by a
previous process when the server boots.

## How the study chatbot works

The chatbot is retrieval-augmented: Gemini never answers from its own
knowledge, only from excerpts of the uploaded files, and it must cite them.

1. **Text extraction.** When a material is uploaded (or the admin presses
   *Rebuild AI chatbot index*), the file's text is extracted directly —
   `.txt/.md/.csv/.log` read as-is, `.pdf` through `unpdf`, and
   `.pptx/.docx/.xlsx` by unzipping the OOXML package with `jszip`. Legacy
   `.ppt/.doc/.xls` fall back to their converted preview PDF. Seeded sample
   rows with no file on disk are skipped.
2. **Chunking.** The text is split into small passages, each stored as a
   `DocumentChunk` with its material, slide/page label and subject.
3. **Embedding.** Every chunk is embedded with `gemini-embedding-001`
   (3072 dimensions) and stored as a compressed float blob in SQLite.
   Indexing runs in a single in-process queue (mirroring the preview queue);
   `src/instrumentation.ts` re-queues interrupted work on boot.
4. **Retrieval.** On each question the student's text is embedded once, the
   nearest chunks are found with a cosine similarity scan in code (no vector
   extension needed), and the top matches become numbered excerpts in the
   system prompt.
5. **Answer.** `gemini-3.5-flash` streams the answer over server-sent
   events; the route relays it as NDJSON events (`session`, `source`,
   `delta`, `done`, `error`) to the browser, which renders tokens as they
   arrive. Transient HTTP 503s from the free tier are retried with backoff.
6. **References.** The excerpts shown under each answer are the *actual*
   retrieved chunks — material title, subject, slide/page and a quote — so
   the references cannot be hallucinated. Each links to the material page.
7. **History.** Conversations are stored per student (`ChatSession` /
   `ChatMessage`) and only the owner can read them; `/chat` requires sign-in.

The admin dashboard shows index coverage (ready materials, searchable chunks,
failures) and the rebuild button, which re-extracts and re-embeds everything.
A failure is never silent: the material records the reason (missing file, no
readable text, or a bad/absent Gemini key).

### Trying it

1. Sign in as `ali.raza@student.university.edu` / `Password123`.
2. Open **Ask AI** in the header (or the floating button on any page) and ask
   a question — e.g. *"What is a smart university ecosystem?"* or the Roman
   Urdu suggestion *"Previous exam questions kya the?"*.
3. On a material page, press **Ask AI** there to restrict answers to that one
   file; the composer shows a scope chip that can be removed again.
4. Stop a long answer mid-stream with the stop button — whatever was
   generated is kept. Delete old conversations from the sidebar.

## Project layout

```
prisma/
  schema.prisma          database schema
  seed.ts                demo subjects, users and material
  migrations/            committed SQL migrations
src/
  app/
    (auth)/              sign-in and registration
    chat/                full-page study chatbot (protected)
    materials/           catalogue, detail, print view
    professor/           upload and management screens
    admin/               dashboard, users, subjects, index rebuild
    api/materials/       download, preview, conversion, text content
    api/chat/            streaming chat endpoint (NDJSON)
  components/
    materials/           cards, filters, preview, upload, pagination
    chat/                chat panel, message bubbles, citations, widget
    admin/               user and subject managers
    ui/                  shadcn/ui components
    auth/                sign-in and registration forms
  lib/
    auth.ts              session creation, verification, role guards
    prisma.ts            Prisma client singleton
    storage.ts           safe file naming and paths
    conversion.ts        LibreOffice and Office COM adapters
    preview-queue.ts     durable conversion queue
    materials.ts         catalogue queries and filters
    file-types.ts        allowed formats, limits, preview strategy
    gemini.ts            Gemini REST client (embeddings + streamed chat)
    extraction.ts        text extraction per file type
    index-queue.ts       chunking, embedding, chatbot index queue
    rag.ts               similarity search and prompt building
  proxy.ts               route protection
  instrumentation.ts     startup recovery (previews + chatbot index)
uploads/                 runtime files, gitignored
```

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint
npx tsc --noEmit   # type check
npx prisma studio  # browse the database
```

## Security notes

These are deliberate choices rather than incidental ones:

- Uploaded files are stored outside `public/` and are never served as static
  assets, so every read goes through a route handler that checks the session.
- Stored filenames are generated UUIDs. The client's filename is kept only as a
  database column for display, and is never used to build a path.
- Paths read back from the database are re-validated before use, so a poisoned
  path cannot escape the uploads directory.
- Conversion shells out with argument arrays rather than an interpolated
  command string, and uses a fresh LibreOffice profile per job.
- Passwords are hashed with bcrypt. Session cookies are httpOnly, `SameSite=Lax`,
  and `Secure` in production.
- The `next` parameter on sign-in is only honoured when it is a single-slash
  relative path, which blocks open-redirect attempts.
- Browsing material is public, but downloads, text previews, favourites, and all
  upload or management routes require a session.
- The Gemini API key lives only in `.env` and is read server-side; it never
  reaches the browser. Chat routes require a signed-in session, and conversations
  are queried by their owner's id, so one student cannot read another's history.
  The system prompt tells the model to answer only from the retrieved excerpts,
  and the citations shown are the real retrieved chunks rather than model output.

## Known limitations

- **Local disk storage.** Uploads live on the machine running the app. Running
  more than one instance needs shared storage or an object store, and the
  conversion queue would need a real worker rather than an in-process one.
- **Conversion is single-process.** The queue is in memory, so a deploy while a
  conversion is running loses the worker, though the job is recovered on boot.
- **SQLite.** Fine for a demo and light use; it should not face concurrent write
  load at university scale.
- **No email verification or password reset.** Both would need an email provider
  before a real deployment.
- **No virus scanning.** Uploaded files are stored as-is. A production system
  should scan on upload.
- **Chatbot runs on the Gemini free tier.** Occasional 503/429 responses are
  retried with backoff, but heavy use will still hit rate limits. Similarity
  search is a linear scan in SQLite, which is fine for thousands of chunks but
  would want a real vector index at much larger scale.
