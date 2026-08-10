import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { db } from "@/lib/db";
import { sendOtpEmail, generateOtp } from "@/lib/email";

const sendOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
  type: z.enum(["REGISTRATION", "PASSWORD_RESET"]),
  name: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = sendOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { email, type, name } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Check rate limiting: no more than 1 OTP per email per 60 seconds
    const recentOtp = await db.otpToken.findFirst({
      where: {
        email: normalizedEmail,
        type,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
    });

    if (recentOtp) {
      return NextResponse.json(
        { error: "Please wait 60 seconds before requesting another code" },
        { status: 429 }
      );
    }

    if (type === "REGISTRATION") {
      // Check email isn't already taken
      const existingUser = await db.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existingUser) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        );
      }
    } else {
      // PASSWORD_RESET: check email exists
      const existingUser = await db.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (!existingUser) {
        // Don't reveal whether email exists — but send a generic success
        return NextResponse.json({ success: true });
      }
    }

    // Generate OTP
    const otp = generateOtp();
    const hashedCode = await bcrypt.hash(otp, 10);

    // Delete any existing unused tokens for this email + type
    await db.otpToken.deleteMany({
      where: { email: normalizedEmail, type, verified: false },
    });

    // Store hashed OTP
    await db.otpToken.create({
      data: {
        email: normalizedEmail,
        code: hashedCode,
        type,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    // Send email
    try {
      await sendOtpEmail(normalizedEmail, otp, type);
    } catch (emailErr: any) {
      console.error("Nodemailer error sending OTP:", emailErr);
      return NextResponse.json(
        { error: `Email error: ${emailErr.message || "Check EMAIL_USER / EMAIL_PASS"}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error sending OTP:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to send verification code. Please try again." },
      { status: 500 }
    );
  }
}
