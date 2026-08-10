<div align="center">

# 💸 Split-It

**A modern, full-stack expense sharing & debt simplification platform built with Next.js 16, TypeScript, Prisma, and Tailwind CSS.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-10b981?style=for-the-badge)](https://web.dev/progressive-web-apps/)

[Features](#-key-features) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started) • [Database Schema](#-database-schema) • [Project Structure](#-project-structure)

</div>

---

## ✨ Key Features

* 🔐 **Authentication & Security:** NextAuth.js (v5) with email/password credentials and email OTP verification for registration & password resets.
* 👥 **Group Management:** Create groups, assign categories (`RESTAURANT`, `VACATION`, `GROCERY`, etc.), set roles (`ADMIN`, `MEMBER`), customized group currencies, and shareable join codes.
* 🧾 **Itemized Line-Item Expense Splits:** Log expenses with individual items, assign specific payers, and split line items equally, fully, or with exact custom amounts/ratios.
* 🧮 **Greedy Debt Simplification Algorithm:** Minimizes overall group transactions by calculating net balances and optimizing direct transfer obligations.
* 🧾 **AI Receipt Scanning:** Integrated OCR endpoint (`/api/ai/scan-receipt`) to auto-extract line items and totals from uploaded bills.
* 📊 **Analytics & Monthly Digest:** Spending analytics visualization (`/api/analytics`) and cron-based email digest generation (`/api/cron/monthly-digest`).
* 📱 **PWA (Progressive Web App):** Installable web app experience with manifest configuration for mobile and desktop devices.

---

## 🛠️ Tech Stack

* **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
* **Styling:** Tailwind CSS v4 + Vanilla CSS + Glassmorphism Dark UI
* **Database & ORM:** PostgreSQL + Prisma ORM v6
* **Auth & Security:** NextAuth.js v5 (Auth.js) + bcryptjs + Nodemailer OTP
* **Validation:** Zod
* **PWA:** Web App Manifest

---

## 🚀 Getting Started

### 1. Prerequisites

Make sure you have Node.js 18+ and PostgreSQL installed locally or access to a cloud PostgreSQL database (e.g., Supabase, Neon, Prisma Postgres).

### 2. Clone the repository

```bash
git clone https://github.com/your-username/split-it.git
cd split-it
