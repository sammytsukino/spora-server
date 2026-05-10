![SPORA-VISUAL](https://res.cloudinary.com/dsy30p7gf/image/upload/v1770388115/SPORA-LACE-TRANSPARENT-MINI_hzwlvt.webp)

**Text becomes generative art. Collaboration without destruction.**

⟡ ═════════════════════════════════════════ ⟡

## ✦ Table of Contents

- [What is SPORA Server?](#-what-is-spora-server)
- [Backend Architecture](#-backend-architecture)
- [API Surface Overview](#-api-surface-overview)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Available Scripts](#-available-scripts)
- [Project Structure](#-project-structure)
- [Language Support](#-language-support)
- [Clean Code Guidelines](#-clean-code-guidelines)
- [Domain and Policy Notes](#-domain-and-policy-notes)
- [Testing Notes](#-testing-notes)
- [License](#-license)
- [Author](#-author)
- [Contact](#-contact)

⟡ ═════════════════════════════════════════ ⟡

## ✿ What is SPORA Server?

`spora-server` is the structural root of SPORA: the API layer where authorship, lineage, moderation, and publication rules are preserved over time.

This repository provides:
♦ Authentication and session continuity  
♦ Flora publishing, lineage memory, and retrieval APIs  
♦ Social graph operations (follow/unfollow)  
♦ Moderation and stewardship operations  
♦ Verification and notification flows  
♦ Contact form email delivery to active admins  
♦ Optional media/voice integrations (Cloudinary + VoiPi)

⟡ ═════════════════════════════════════════ ⟡

## ♢ Backend Architecture

### Runtime and Security
▸ Node.js + Express  
▸ MongoDB + Mongoose  
▸ `helmet`, `cors`, `express-rate-limit` (for brute-force prevention), `cookie-parser`  
▸ `express-async-errors` for async error propagation
▸ Honeypot mechanism for invisible bot protection during signup

### Auth Model
▸ Access token (short-lived JWT, bearer)  
▸ Refresh token (JWT in secure HTTP-only cookie)  
▸ Account status enforcement (`active`, `suspended`, `deleted`)  
▸ Role enforcement (`cultivator`, `admin`)

### Content and Governance
▸ Flora schema includes lineage, generative payload, license, and moderation state  
▸ Report system for user-generated moderation events  
▸ Admin action logging via dedicated model  
▸ Automatic language-screen report sync for created/updated Floras

### Optional Integrations
▸ Cloudinary for avatar/flora thumbnail uploads  
▸ VoiPi for `/api/reader/tts` audio generation

⟡ ═════════════════════════════════════════ ⟡

## ❖ API Surface Overview

The API is organized as a set of bounded domains:

### Health
▸ `GET /api/health`

### Authentication
▸ `POST /api/auth/signup`  
▸ `POST /api/auth/signin`  
▸ `POST /api/auth/refresh`  
▸ `POST /api/auth/logout`  
▸ `GET /api/auth/me`  
▸ `PATCH /api/auth/me`  
▸ `GET|POST /api/auth/verify-email`

### Floras
▸ `GET /api/floras`  
▸ `GET /api/floras/:id`  
▸ `POST /api/floras/screen-preview`  
▸ `POST /api/floras`  
▸ `PATCH /api/floras/:id`  
▸ `DELETE /api/floras/:id`

### Reader
▸ `POST /api/reader/tts` (powered by VoiPi provider fallback)

### Social
▸ `GET /api/follows/me/following`  
▸ `POST /api/follows/:userId`  
▸ `DELETE /api/follows/:userId`  
▸ `GET /api/follows/:userId/status`

### Reports
▸ `POST /api/reports`

### Contact
▸ `POST /api/contact` (public contact form -> notification emails to active admins)

### Admin
▸ `GET /api/admin/floras` + moderation updates  
▸ `GET /api/admin/reports` + review actions  
▸ `GET /api/admin/users` + role/status/account actions  
▸ `GET /api/admin/metrics`  
▸ `GET /api/admin/usage`  
▸ `GET /api/admin/usage/charts`  
▸ Batch endpoints for users/floras/reports

⟡ ═════════════════════════════════════════ ⟡

## ⚙ Tech Stack

### Core
▸ Node.js (>=18)  
▸ Express 4  
▸ MongoDB + Mongoose 8

### Security and Auth
▸ jsonwebtoken  
▸ bcryptjs  
▸ helmet  
▸ cors  
▸ express-rate-limit  
▸ cookie-parser

### Infrastructure and Services
▸ dotenv  
▸ morgan  
▸ nodemailer  
▸ cloudinary

### Quality
▸ Jest  
▸ Supertest  
▸ Nodemon (development)

⟡ ═════════════════════════════════════════ ⟡

## ◆ Getting Started

### Prerequisites
```bash
Node.js >= 18
npm >= 9
MongoDB (local, Docker, or cloud URI)
```

### Installation
```bash
git clone https://github.com/sammytsukino/spora-server.git
cd spora-server
npm install
```

### Environment Variables
Create `.env` in repository root (same level as `index.js`).

Minimal local setup:
```env
PORT=4000
JWT_SECRET=use_a_long_random_string_at_least_32_chars
MONGODB_URI=mongodb://localhost:27017/sporadb
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173
```

Also supported (optional / feature-dependent):
```env
# Legacy Mongo alias also accepted
MONGO_URL=

# SMTP for transactional emails
# (account verification + admin report alerts + admin contact alerts)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# Cloudinary for avatar/flora thumbnails
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Reader TTS uses VoiPi (no API key required by default)
# It will try edge-tts, then google-tts, then piper.
```

Important startup constraints:
▸ `JWT_SECRET` is mandatory and must be at least 32 characters  
▸ In production, `CORS_ORIGIN` must be explicit (never `*`)

### Run
```bash
npm run dev   # nodemon index.js
# or
npm start     # node index.js
```

⟡ ═════════════════════════════════════════ ⟡

## ◈ Available Scripts

```bash
npm run dev            # Start development server with nodemon
npm run server         # Alias of dev
npm start              # Start production server
npm test               # Run Jest suite
npm run test:watch     # Jest watch mode
npm run test:coverage  # Coverage report
```

⟡ ═════════════════════════════════════════ ⟡

## ◈ Project Structure

```text
spora-server/
├── index.js                      # Main runtime entry; boots src/server.js
├── src/
│   ├── app.js                    # Express app composition (routes + middleware)
│   ├── server.js                 # Server bootstrap and DB connection
│   ├── config/                   # Config helpers
│   ├── controllers/              # Domain/business handlers
│   ├── lib/                      # Auth/session/security utility modules
│   ├── middleware/               # Auth + error middleware
│   ├── models/                   # Mongoose domain models
│   ├── routes/                   # Route modules for modular stack
│   └── services/                 # Email and moderation supporting services
├── config/                       # Shared static moderation config
├── postman_collection.json       # API testing collection
└── README.md
```

⟡ ═════════════════════════════════════════ ⟡

## ◈ Language Support

SPORA currently operates with mixed UI/content strings and supports usage in:
▸ **Español**  
▸ **Castellano**

This includes user-facing content and editorial copy currently present across the project.

⟡ ═════════════════════════════════════════ ⟡

## ◈ Clean Code Guidelines

These conventions keep `spora-server` maintainable and aligned with current architecture:

### 1) Keep domain boundaries clear
▸ `routes/` only wires endpoints and middleware  
▸ `controllers/` handle request/response orchestration  
▸ `services/` own reusable cross-domain logic (email, moderation helpers, etc.)  
▸ `models/` remain focused on schema/domain shape

### 2) Validate early, fail explicitly
▸ Validate required input fields at controller entry  
▸ Return precise HTTP status + concise error messages  
▸ Avoid silent fallbacks unless explicitly intended for non-critical integrations

### 3) Preserve platform invariants
▸ Keep lineage/moderation/auth rules explicit (not implicit in side effects)  
▸ Protect role/account-status checks close to route boundaries  
▸ Use small helpers for repeated policy logic

### 4) Prefer readable constants over magic values
▸ Extract limits/time windows/status names into named constants  
▸ Use descriptive names (`MAX_MESSAGE_LENGTH`, `ACCESS_TOKEN_EXPIRY`) over inline literals

### 5) Keep async flows understandable
▸ Use early returns to reduce nesting  
▸ Group independent async calls with `Promise.all` where safe  
▸ Log integration failures with context (SMTP/Cloudinary/TTS) without leaking sensitive data

### 6) Protect API contracts
▸ Update README and route docs when endpoint behavior changes  
▸ Keep response shapes stable for frontend consumers  
▸ Add or update tests for changed auth/moderation/email-critical paths

⟡ ═════════════════════════════════════════ ⟡

## ♡ Domain and Policy Notes

### Roles
▸ **Cultivator**: create/publish/manage own Floras and profile  
▸ **Admin**: moderation, user governance, reporting analytics

### Collaboration Integrity
▸ Lineage metadata is preserved across derivative creation  
▸ Moderation actions rely on soft-state transitions where possible  
▸ Anonymization workflows preserve ecosystem continuity

### Compliance-Oriented Behaviors
▸ Account/status controls support reversible moderation  
▸ Author anonymization endpoints preserve derived Flora operability  
▸ Sensitive-language screening is tracked and reviewable

⟡ ═════════════════════════════════════════ ⟡

## ◑ Testing Notes

Backend tests include:
▸ Route-level behavior checks  
▸ Middleware validations  
▸ Utility service tests (token and language screening flows)

Suggested validation pass before deployment:
```bash
npm test
npm run test:coverage
```

⟡ ═════════════════════════════════════════ ⟡

## ◍ License

This repository is part of the SPORA project.
Code license details should be defined in the project `LICENSE` file.

Individual Floras published in the platform are licensed by their authors under platform rules.

⟡ ═════════════════════════════════════════ ⟡

## ◕ Author

**Sammy Cabello**  
SPORA ▸ CEI: Centros de Estudios de Innovacion  
Academic Year: 2025-2026

⟡ ═════════════════════════════════════════ ⟡

## ◈ Contact

▸ **Email:** sammy.cabello.g@gmail.com  
▸ **GitHub:** [@sammytsukino](https://github.com/sammytsukino)

⟡ ═════════════════════════════════════════ ⟡

**SPORA Server** ♡ The backend soil where collaboration, lineage, and governance are rooted.
