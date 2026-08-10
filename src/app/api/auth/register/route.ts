import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .regex(/\d/, "Password must contain at least 1 number")
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Password must contain at least 1 special character (e.g. !@#$%)"),
  otpVerified: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Verify that OTP was verified for this email
    const verifiedToken = await db.otpToken.findFirst({
      where: {
        email: normalizedEmail,
        type: "REGISTRATION",
        verified: true,
        expiresAt: { gt: new Date(Date.now() - 30 * 60 * 1000) }, // within last 30 min
      },
      orderBy: { createdAt: "desc" },
    });

    if (!verifiedToken) {
      return NextResponse.json(
        { error: "Email not verified. Please verify your email first." },
        { status: 400 },
      );
    }

    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        emailVerified: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    // Clean up used OTP tokens
    await db.otpToken.deleteMany({
      where: { email: normalizedEmail, type: "REGISTRATION" },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
