# 🏠 Nestly — Dormitory Management Platform

<p>
  <a href="https://it-project-alpha.vercel.app"><img src="https://img.shields.io/badge/Live_demo-1F4D3A?style=for-the-badge&logo=vercel&logoColor=white" alt="Live demo"/></a>
  <img src="https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js"/>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Prisma_7-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma"/>
</p>

Nestly is a multi-property SaaS platform for running dormitories in one place — rooms, tenants, leases, utility billing, maintenance requests, parcels, announcements and chat. Each property's data is isolated by `propertyId`, and every permission check happens on the server.

## ✨ Features

- **Property setup** — buildings, floors, rooms, room types, furniture and room status
- **Tenants & occupancy** — invitations, move-in, room transfers and move-out with deposit settlement
- **Leases** — lease contracts with versioned snapshots and generated PDF documents
- **Billing** — water/electricity meter readings, monthly invoices, payment-slip upload and verification
- **Service desk** — maintenance and complaint tickets with timelines, replies and attachments
- **Community** — parcel tracking, targeted announcements and tenant ↔ property chat
- **SaaS subscriptions** — plans, trials, renewals and subscription payment review
- **Audit log** — who did what, when, and whether it succeeded

## 👥 User roles

| Role | Who | What they can do |
| :--- | :--- | :--- |
| `SUPER_ADMIN` | Platform admin | Manage owner accounts, properties, subscription plans, payments and audit logs |
| `PROPERTY_ADMIN` | Dorm owner / manager | Manage rooms, tenants, leases, invoices, meters, tickets, parcels, announcements and settings |
| `TENANT` | Resident | View room, lease and invoices, upload payment slips, report issues, receive parcels and chat with the dorm |

## 🧱 Architecture

```text
Browser ──► Next.js API route ──► Zod validation
                  │
                  ├── session, role and property-ownership checks
                  ▼
           Service / business logic ──► Repository (Prisma) ──► PostgreSQL
                                                   │
                                     Local storage or Amazon S3 (PDFs, slips, attachments)
```

- **114 API routes / 144 HTTP operations** documented in [`docs/openapi.json`](docs/openapi.json)
- **44 domain models**, 29 enums and versioned Prisma migrations
- Files are stored outside the database; PostgreSQL keeps only metadata and storage keys

## 🔐 Security highlights

- `HttpOnly` session cookies; only SHA-256 hashes of session tokens are stored
- Password hashing, login throttling and API rate limiting
- Role-based access control with property-membership checks on every sensitive route
- Origin checks on state-changing requests and schema validation for all input
- Upload checks for real file type, size and ownership; private files served through authorized endpoints

## 🛠️ Tech stack

| Layer | Tools |
| :--- | :--- |
| App & API | Next.js 16 (App Router), React 19, TypeScript (strict) |
| Styling | Tailwind CSS 4 |
| Data | PostgreSQL, Prisma 7, Zod 4 |
| Files & documents | Amazon S3 or local storage, Puppeteer (PDF), QR codes |
| Testing & quality | Vitest, Playwright, ESLint, SonarQube |

## 🚀 Getting started

```bash
npm install                 # install dependencies and generate the Prisma client
cp .env.example .env        # then set DATABASE_URL and other required values
npm run db:migrate          # create/update the development database
npm run dev                 # open http://localhost:3000
```

### Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run test:e2e
npm run openapi:check
npm run build
```

## 📚 Documentation

- [Project guide (TH)](docs/PROJECT_GUIDE_TH.md)
- [Product requirements (TH)](docs/COMPLETE_PRODUCT_REQUIREMENTS_TH.md)
- [API endpoints (TH)](docs/API_ENDPOINTS_TH.md) · [OpenAPI spec](docs/openapi.json)
- [Document system](docs/DOCUMENT_SYSTEM.md) · [Background jobs](docs/BACKGROUND_JOBS.md)
- [Deployment (TH)](docs/DEPLOY_TH.md) · [Team handoff (TH)](docs/TEAM_HANDOFF_TH.md)
