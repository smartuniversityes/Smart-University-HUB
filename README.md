# Smart University Ecosystem

A material hub for a university department. Professors upload lecture slides,
notes and PDFs; students search the catalogue, preview documents in the browser,
print, download, and save favourites.

Built for a final year project, so it is deliberately small, readable and easy to
demonstrate, while still covering the parts that matter: authentication, roles,
file storage, document conversion and access control.

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

NEXT_PUBLIC_SITE_NAME="Smart University"
```

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

## Project layout

```
prisma/
  schema.prisma          database schema
  seed.ts                demo subjects, users and material
  migrations/            committed SQL migrations
src/
  app/
    (auth)/              sign-in and registration
    materials/           catalogue, detail, print view
    professor/           upload and management screens
    admin/               dashboard, users, subjects
    api/materials/       download, preview, conversion, text content
  components/
    materials/           cards, filters, preview, upload, pagination
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
  proxy.ts               route protection
  instrumentation.ts     startup recovery
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
