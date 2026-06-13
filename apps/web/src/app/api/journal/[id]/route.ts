import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateJournalSchema } from "@/lib/validations";
import { logDataMutation } from "@/security/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const entry = await db.journalEntry.findFirst({
      where: { id, userId: session.user.id },
      include: {
        aiInsights: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!entry) {
      return NextResponse.json({ success: false, error: "Journal entry not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    console.error("Journal GET by ID error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch journal entry" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json() as unknown;
    const parsed = updateJournalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.errors },
        { status: 422 }
      );
    }

    const existing = await db.journalEntry.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Journal entry not found" }, { status: 404 });
    }

    const updateData = { ...parsed.data } as Record<string, unknown>;
    if (typeof updateData["content"] === "string") {
      updateData["wordCount"] = (updateData["content"] as string).trim().split(/\s+/).length;
    }

    const updated = await db.journalEntry.update({
      where: { id },
      data: updateData,
    });

    await logDataMutation(session.user.id, "update", "journal_entry", { entryId: id });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Journal PATCH error:", error);
    return NextResponse.json({ success: false, error: "Failed to update journal entry" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await db.journalEntry.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Journal entry not found" }, { status: 404 });
    }

    await db.journalEntry.delete({ where: { id } });
    await logDataMutation(session.user.id, "delete", "journal_entry", { entryId: id });

    return NextResponse.json({ success: true, message: "Journal entry deleted" });
  } catch (error) {
    console.error("Journal DELETE error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete journal entry" }, { status: 500 });
  }
}
