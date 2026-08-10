💸 Split-It
A modern, full-stack expense sharing & debt simplification platform built with Next.js 16, TypeScript, Prisma, and Tailwind CSS.

Next.jsReactTypeScriptPrismaTailwind CSSPWA Ready

Features
 • 
Tech Stack
 • 
Getting Started
 • 
Database Schema
 • 
Project Structure

✨ Key Features
🔐 Authentication & Security: NextAuth.js (v5) with email/password credentials and email OTP verification for registration & password resets.
👥 Group Management: Create groups, assign categories (RESTAURANT, VACATION, GROCERY, etc.), set roles (ADMIN, MEMBER), customized group currencies, and shareable join codes.
🧾 Itemized Line-Item Expense Splits: Log expenses with individual items, assign specific payers, and split line items equally, fully, or with exact custom amounts/ratios.
🧮 Greedy Debt Simplification Algorithm: Minimizes overall group transactions by calculating net balances and optimizing direct transfer obligations.
🧾 AI Receipt Scanning: Integrated OCR endpoint (/api/ai/scan-receipt) to auto-extract line items and totals from uploaded bills.
📊 Analytics & Monthly Digest: Spending analytics visualization (/api/analytics) and cron-based email digest generation (/api/cron/monthly-digest).
📱 PWA (Progressive Web App): Installable web app experience with manifest configuration for mobile and desktop devices.
🛠️ Tech Stack
Framework: Next.js 16 (App Router) + React 19 + TypeScript
Styling: Tailwind CSS v4 + Vanilla CSS + Glassmorphism Dark UI
Database & ORM: PostgreSQL + Prisma ORM v6
Auth & Security: NextAuth.js v5 (Auth.js) + bcryptjs + Nodemailer OTP
Validation: Zod
PWA: Web App Manifest
🚀 Getting Started
1. Prerequisites
Make sure you have Node.js 18+ and PostgreSQL installed locally or access to a cloud PostgreSQL database (e.g., Supabase, Neon, Prisma Postgres).

2. Clone the repository
bash

git clone https://github.com/your-username/split-it.git
cd split-it
3. Install dependencies
bash

npm install
4. Configure Environment Variables
Copy .env.example to .env:

bash

cp .env.example .env
Update your .env with your actual database connection string and authentication secrets:

env

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/splitit?schema=public"
AUTH_SECRET="your-random-32-byte-secret"
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="your-email@gmail.com"
EMAIL_SERVER_PASSWORD="your-app-password"
EMAIL_FROM="Split-It <noreply@split-it.com>"
5. Push Schema to Database
Generates Prisma Client and syncs database tables:

bash

npm run db:push
6. Run Development Server
bash

npm run dev
Open http://localhost:3000 in your browser.

📜 Available Scripts
Command	Description
npm run dev	Starts the Next.js development server
npm run build	Builds the production bundle
npm run start	Runs the production build
npm run lint	Runs ESLint checks
npm run db:generate	Generates Prisma Client types
npm run db:push	Pushes Prisma schema directly to PostgreSQL database
npm run db:studio	Opens Prisma Studio GUI database explorer
🗄️ Database Schema
The core models defined in 
prisma/schema.prisma
:


User (id, name, email, passwordHash, emailVerified...)
 ├── GroupMember (groupId, userId, role) ── Group (id, name, type, currency, inviteCode...)
 ├── Expense (groupId, title, category, createdById...)
 │    └── ExpenseItem (expenseId, name, amount, payerId, splitType)
 │         └── ItemSplit (expenseItemId, userId, shareAmount)
 └── OtpToken (email, code, type, expiresAt...)
📂 Project Structure

split-it/
├── prisma/
│   └── schema.prisma         # PostgreSQL schema definition
├── src/
│   ├── app/
│   │   ├── (auth)/           # Login, Register, Forgot Password
│   │   ├── (dashboard)/      # Dashboard, Groups, Profile, Analytics
│   │   ├── api/              # Auth, Group, User, AI, Analytics & Cron APIs
│   │   ├── globals.css       # Global styles & Tailwind configuration
│   │   └── manifest.ts       # PWA manifest
│   ├── components/           # UI components grouped by feature domain
│   └── lib/
│       ├── auth.ts           # NextAuth configuration
│       ├── balances.ts       # Debt calculation & simplification algorithm
│       ├── db.ts             # Prisma client instance
│       └── email.ts          # Nodemailer email logic
└── package.json
🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

📝 License
Distributed under the MIT License. See LICENSE for more information.
