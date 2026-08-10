import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { db } from "@/lib/db";

const verifyOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
  code: z.string().length(4, "Code must be 4 digits"),
  type: z.enum(["REGISTRATION", "PASSWORD_RESET"]),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = verifyOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { email, code, type } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Find the latest unexpired, unverified OTP for this email + type
    const otpToken = await db.otpToken.findFirst({
      where: {
        email: normalizedEmail,
        type,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpToken) {
      return NextResponse.json(
        { error: "Code expired or not found. Please request a new one." },
        { status: 400 }
      );
    }

    // Compare codes
    const isValid = await bcrypt.compare(code, otpToken.code);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid code. Please check and try again." },
        { status: 400 }
      );
    }

    // Mark as verified
    await db.otpToken.update({
      where: { id: otpToken.id },
      data: { verified: true },
    });

    return NextResponse.json({ success: true, verified: true });
  } catch (error: any) {
    console.error("Error verifying OTP:", error);
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
