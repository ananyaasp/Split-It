import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
});

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { name } = parsed.data;
    const userId = session.user.id;

    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { lastNameChange: true },
    });

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    if (user.lastNameChange) {
      const timeSinceChange = Date.now() - new Date(user.lastNameChange).getTime();
      if (timeSinceChange < SEVEN_DAYS_MS) {
        const nextAllowedDate = new Date(
          new Date(user.lastNameChange).getTime() + SEVEN_DAYS_MS
        ).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        return NextResponse.json(
          {
            error: `Name can only be updated once every 7 days. Next change allowed on ${nextAllowedDate}.`,
          },
          { status: 400 }
        );
      }
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        name: name.trim(),
        lastNameChange: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        lastNameChange: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error: any) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile name" },
      { status: 500 }
    );
  }
}
