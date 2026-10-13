# Smart University Material Hub

**Final Year Project Proposal**

| | |
|---|---|
| **Student** | Anas |
| **Registration No.** | [Your Reg No] |
| **Degree Programme** | [e.g. B.Sc. Computer Science] |
| **Supervisor** | [Supervisor Name] |
| **Title** | Smart University: A Centralised Lecture Material Hub |

---

## 1. Introduction

Universities generate large volumes of lecture material — slides, handouts,
reference sheets and past papers. Today these files are scattered across group
chats, emails and USB drives. Students frequently miss files, download outdated
copies, or cannot find the file for a subject at all. Professors re-share the
same file every semester.

This project builds a single web-based repository where professors upload course
material once and students search, preview and download it from any device.

## 2. Problem Statement

- No single, organised place for course material.
- Files are lost, duplicated, or outdated across group chats and emails.
- Students cannot preview files before downloading them.
- Professors re-upload the same files every semester.
- No central record of what material exists per subject/semester.

## 3. Aim & Objectives

**Aim:** Develop a responsive web platform for publishing, discovering and
previewing university lecture material.

**Objectives:**
1. Provide role-based accounts (Student, Professor, Admin).
2. Allow professors to upload material tagged with subject and semester.
3. Let students search and filter by keyword, semester, subject and file type.
4. Preview documents (PDF, PowerPoint, Word, Excel, text) in the browser.
5. Track downloads and favourites for per-material analytics.
6. Give admins a dashboard to manage users and subjects.

## 4. Scope

**In scope:**
- Student: browse, search, filter, preview, favourite, download.
- Professor: upload, edit, delete own material, view download counts.
- Admin: manage users, roles, subjects; dashboard with system stats.
- File types: PDF, PPTX, DOCX, XLSX, TXT, MD, CSV, LOG (limited by size).
- Deployment to the cloud with persistent storage.

**Out of scope:**
- Real-time chat, notifications via email/SMS, LMS (VLE) integration,
  plagiarism checking, multi-institution support.

## 5. Proposed Solution & Key Features

- **Authentication** — sign up as Student or Professor; Admin; secure session cookies.
- **Material upload** — professors tag files with subject, semester and description.
- **Search & filters** — keyword search with filters for semester, subject, professor, type, and sort by newest / most downloaded / title; paginated results.
- **Browser preview** — PDFs render directly; Office files are converted to PDF automatically for preview.
- **Favourites & analytics** — students save material; system records download counts.
- **Admin panel** — dashboard, user/subject management, preview-conversion status.
- **Responsive design** — full layout for phones, tablets and desktops.

## 6. System Architecture

The application follows an **MVC-style layered architecture**:

- **Model** (`src/models/`) — data access and business rules (users, subjects, materials, favourites, downloads, dashboard stats) built on Prisma + SQLite.
- **Controller** — thin server actions and API routes that validate input, check permissions and call models.
- **View** — React server components and UI components that render pages without touching the database.

Web requests → **Controller** (validate/authorize) → **Model** (data + business logic) → SQLite database, with uploaded files stored on a persistent volume.

## 7. Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router), React 19 |
| Styling | Tailwind CSS, shadcn/ui |
| Database | SQLite via Prisma ORM |
| Authentication | JWT sessions (httpOnly cookie) |
| Preview engine | LibreOffice PDF conversion |
| Deployment | Docker container, cloud host (Railway / Fly.io / VPS) |

## 8. Expected Outcomes

- A working, responsive material hub testable on laptop and mobile.
- Fast preview of slides/documents without downloading first.
- Download and favourite statistics for each lecture.
- Clean administrative control over users, roles and subjects.
- A deployable Docker image runnable on any cloud host.

## 9. Development Plan (Phases)

| Phase | Tasks | Duration |
|---|---|---|
| 1 – Design | Requirements, schema, architecture, proposals | 2 weeks |
| 2 – Core | Auth + roles, subject management, upload | 4 weeks |
| 3 – Discovery | Search, filters, pagination, favourites | 3 weeks |
| 4 – Preview | PDF/text preview, Office conversion (LibreOffice) | 3 weeks |
| 5 – Admin & Reports | Dashboard, user/subject management | 2 weeks |
| 6 – Polish | Responsiveness, print view, testing on mobile | 2 weeks |
| 7 – Deployment | Docker, cloud hosting, volume storage, handover | 2 weeks |

## 10. Conclusion

The Smart University Material Hub addresses a real, everyday problem: scattered
and lost course material. By combining a simple role-based repository with
in-browser preview and cloud deployment, the project delivers a practical
system that is both easy to use and technically sound.