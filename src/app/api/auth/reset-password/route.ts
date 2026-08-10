import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
  code: z.string().length(4, "Code must be 4 digits"),
  newPassword: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .regex(/\d/, "Password must contain at least 1 number")
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Password must contain at least 1 special character (e.g. !@#$%)"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { email, code, newPassword } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Check user exists
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email." },
        { status: 404 }
      );
    }

    // Verify OTP token
    const otpToken = await db.otpToken.findFirst({
      where: {
        email: normalizedEmail,
        type: "PASSWORD_RESET",
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpToken) {
      return NextResponse.json(
        { error: "Code expired or invalid. Please request a new one." },
        { status: 400 }
      );
    }

    const isValid = await bcrypt.compare(code, otpToken.code);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code." },
        { status: 400 }
      );
    }

    // Hash new password & update user
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Mark token as verified & delete reset tokens
    await db.otpToken.deleteMany({
      where: { email: normalizedEmail, type: "PASSWORD_RESET" },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "Password reset failed. Please try again." },
      { status: 500 }
    );
  }
}
