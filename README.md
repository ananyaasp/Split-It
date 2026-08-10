# Split-It

A Splitwise-style app for tracking shared expenses, splitting bills, and understanding spending patterns.

## Stack

- **Frontend & API:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** NextAuth (Auth.js) with email/password credentials

## Week 1 — What's included

- [x] Next.js + TypeScript + Tailwind scaffold
- [x] PostgreSQL schema draft (users, groups, expenses, splits)
- [x] Sign up / sign in / sign out
- [x] Protected dashboard layout (dashboard, groups, profile)

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example env file and set your values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Random secret for sessions (`openssl rand -base64 32`) |

**Database options:**

- **Local PostgreSQL:** `postgresql://postgres:postgres@localhost:5432/splitit?schema=public`
- **Prisma Postgres (dev):** run `npx prisma dev` and use the URL it prints

### 3. Push schema to database

```bash
npm run db:push
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
├── app/
│   ├── (auth)/          # Login & register
│   ├── (dashboard)/     # Protected pages
│   └── api/auth/        # NextAuth + register API
├── components/
├── lib/
│   ├── auth.ts          # NextAuth config
│   └── db.ts            # Prisma client
└── generated/prisma/    # Prisma client output
```

## Next up (Phase 1)

- Create groups and invite members
- Add expenses with line-item splits
- Balance calculation engine
- Activity log ("User A owes User B ₹X")
