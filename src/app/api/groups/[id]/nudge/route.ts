import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId } = await params;
  const currentUserId = session.user.id;

  try {
    const body = await request.json();
    const { debtorId, debtorEmail, debtorName, amount } = body;

    if (!debtorId || !debtorEmail || !amount) {
      return NextResponse.json(
        { error: "Invalid debt information" },
        { status: 400 }
      );
    }

    // Verify current user membership
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: currentUserId } },
      include: {
        group: true,
        user: { select: { name: true } },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const group = membership.group;
    const creditorName = membership.user.name;
    const currency = group.currency || "₹";

    // Rate limiting: check if nudge token was sent for this email + group in last 24 hours
    const recentNudge = await db.otpToken.findFirst({
      where: {
        email: debtorEmail.toLowerCase(),
        type: "REGISTRATION", // reuse token table for nudge logging
        code: `NUDGE_${groupId}`,
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (recentNudge) {
      return NextResponse.json(
        {
          error:
            "A reminder was already sent to this member in the last 24 hours.",
        },
        { status: 429 }
      );
    }

    // Log nudge in OtpToken table for rate limiting
    await db.otpToken.create({
      data: {
        email: debtorEmail.toLowerCase(),
        code: `NUDGE_${groupId}`,
        type: "REGISTRATION",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Send Nudge email
    const groupUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/groups/${group.id}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #059669; font-size: 24px; margin: 0;">Split-It</h1>
        </div>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 12px;">🔔</div>
          <h2 style="color: #18181b; font-size: 18px; margin: 0 0 8px;">Friendly Debt Settlement Reminder</h2>
          <p style="color: #52525b; font-size: 14px; margin: 0 0 20px; line-height: 1.5;">
            Hi <strong>${debtorName}</strong>, <strong>${creditorName}</strong> sent a friendly reminder regarding your pending balance in <strong>${group.name}</strong>.
          </p>
          <div style="background: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <p style="color: #71717a; font-size: 12px; margin: 0 0 4px; uppercase; letter-spacing: 1px;">Amount Pending</p>
            <p style="color: #059669; font-size: 28px; font-weight: 800; margin: 0;">${currency}${amount}</p>
          </div>
          <a href="${groupUrl}" style="background: #059669; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 10px; display: inline-block;">
            View Group & Settle Up
          </a>
        </div>
        <p style="color: #a1a1aa; font-size: 11px; text-align: center; margin-top: 24px;">
          Sent via Split-It • Splitting bills made effortless
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Split-It" <${process.env.EMAIL_USER}>`,
      to: debtorEmail,
      subject: `Split-It: Friendly reminder from ${creditorName} (${currency}${amount})`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error sending nudge:", error);
    return NextResponse.json(
      { error: "Failed to send reminder email" },
      { status: 500 }
    );
  }
}
