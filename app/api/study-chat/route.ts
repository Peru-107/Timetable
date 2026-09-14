import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { answerStudyQuestion, type StudyMaterialContext } from "@/lib/studyChat";

// A cross-subject question can involve gathering and sending a lot of
// study material text to Gemini - give this the same headroom as the
// other Gemini-calling routes.
export const maxDuration = 90;

// How many prior turns to replay as conversation history on each new
// question - enough for the model to follow a real back-and-forth without
// the request growing unbounded as a thread gets long.
const MAX_HISTORY_MESSAGES = 20;

async function assertOwnership(userId: string, semesterId: string, courseId: string | null) {
  const semester = await prisma.semester.findFirst({ where: { id: semesterId, userId } });
  if (!semester) return false;
  if (courseId) {
    const course = await prisma.course.findFirst({ where: { id: courseId, semesterId } });
    if (!course) return false;
  }
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const semesterId = req.nextUrl.searchParams.get("semesterId");
    const courseId = req.nextUrl.searchParams.get("courseId");
    if (!semesterId) {
      return NextResponse.json({ error: "Semester ID required" }, { status: 400 });
    }

    const owns = await assertOwnership(session.user.id, semesterId, courseId);
    if (!owns) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { userId: session.user.id, semesterId, courseId: courseId || null },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error fetching study chat:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { semesterId, courseId, question, useWebSearch } = await req.json();
    if (!semesterId || !question?.trim()) {
      return NextResponse.json({ error: "Semester ID and question required" }, { status: 400 });
    }

    const owns = await assertOwnership(session.user.id, semesterId, courseId || null);
    if (!owns) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Prior turns, fetched before this question is saved so it isn't
    // duplicated into its own history.
    const priorMessages = await prisma.chatMessage.findMany({
      where: { userId: session.user.id, semesterId, courseId: courseId || null },
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY_MESSAGES,
    });
    const history = priorMessages
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const userMessage = await prisma.chatMessage.create({
      data: {
        userId: session.user.id,
        semesterId,
        courseId: courseId || null,
        role: "user",
        content: question,
        usedWebSearch: !!useWebSearch,
      },
    });

    // Gather this scope's completed study material as context - one
    // course's files for a course-scoped thread, every course's files in
    // the semester for the cross-subject thread.
    let materials: StudyMaterialContext[];
    if (courseId) {
      const rows = await prisma.studyMaterial.findMany({
        where: { courseId, status: "completed" },
      });
      materials = rows.map((r) => ({ fileName: r.fileName, extractedText: r.extractedText || "" }));
    } else {
      const courses = await prisma.course.findMany({
        where: { semesterId },
        include: { studyMaterials: { where: { status: "completed" } } },
      });
      materials = courses.flatMap((c) =>
        c.studyMaterials.map((m) => ({
          fileName: m.fileName,
          courseName: c.name,
          extractedText: m.extractedText || "",
        }))
      );
    }

    try {
      const answer = await answerStudyQuestion(question, materials, history, !!useWebSearch);
      const assistantMessage = await prisma.chatMessage.create({
        data: {
          userId: session.user.id,
          semesterId,
          courseId: courseId || null,
          role: "assistant",
          content: answer,
          usedWebSearch: !!useWebSearch,
        },
      });
      return NextResponse.json({ userMessage, assistantMessage }, { status: 201 });
    } catch (chatError) {
      console.error("Study chat answer error:", chatError);
      const assistantMessage = await prisma.chatMessage.create({
        data: {
          userId: session.user.id,
          semesterId,
          courseId: courseId || null,
          role: "assistant",
          content: "Sorry, I couldn't process that question right now. Please try again in a moment.",
          usedWebSearch: false,
        },
      });
      return NextResponse.json({ userMessage, assistantMessage }, { status: 201 });
    }
  } catch (error) {
    console.error("Error in study chat:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
