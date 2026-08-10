import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateGroupBalances } from "@/lib/balances";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function GET(request: Request) {
  // Optional security check
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized cron execution" }, { status: 401 });
  }

  try {
    const groups = await db.group.findMany({
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        expenses: {
          include: {
            items: {
              include: {
                splits: true,
              },
            },
          },
        },
      },
    });

    let emailsSent = 0;

    for (const group of groups) {
      if (group.expenses.length === 0) continue;

      const memberSummaries = group.members.map((m) => m.user);
      const formattedExpenses = group.expenses.map((exp) => ({
        id: exp.id,
        title: exp.title,
        category: exp.category,
        expenseDate: exp.expenseDate,
        createdById: exp.createdById,
        items: exp.items.map((item) => ({
          id: item.id,
          name: item.name,
          amount: Number(item.amount),
          payerId: item.payerId,
          splits: item.splits.map((s) => ({
            userId: s.userId,
            shareAmount: s.shareAmount ? Number(s.shareAmount) : 0,
          })),
        })),
      }));

      const balancesData = calculateGroupBalances(memberSummaries, formattedExpenses);
      const currency = group.currency || "₹";

      for (const debt of balancesData.pairwiseDebts) {
        if (debt.amount <= 0) continue;

        const debtor = debt.fromUser;
        const creditor = debt.toUser;

        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #059669; font-size: 24px; margin: 0;">Split-It</h1>
            </div>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px; text-align: center;">
              <div style="font-size: 40px; margin-bottom: 12px;">📅</div>
              <h2 style="color: #18181b; font-size: 18px; margin: 0 0 8px;">Monthly Settlement Digest</h2>
              <p style="color: #52525b; font-size: 14px; margin: 0 0 20px; line-height: 1.5;">
                Hi <strong>${debtor.name}</strong>, here is your monthly balance summary for <strong>${group.name}</strong>.
              </p>
              <div style="background: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #71717a; font-size: 12px; margin: 0 0 4px; uppercase; letter-spacing: 1px;">Pending to ${creditor.name}</p>
                <p style="color: #dc2626; font-size: 28px; font-weight: 800; margin: 0;">${currency}${debt.amount}</p>
              </div>
              <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/groups/${group.id}" style="background: #059669; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 10px; display: inline-block;">
                Settle Up Now
              </a>
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: `"Split-It Digest" <${process.env.EMAIL_USER}>`,
          to: debtor.email,
          subject: `Split-It Monthly Digest: Pending balance of ${currency}${debt.amount} in ${group.name}`,
          html,
        });

        emailsSent++;
      }
    }

    return NextResponse.json({ success: true, emailsSent });
  } catch (error: any) {
    console.error("Error running monthly digest:", error);
    return NextResponse.json({ error: "Failed to send digest emails" }, { status: 500 });
  }
}
