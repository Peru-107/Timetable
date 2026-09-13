import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractStudyMaterialText } from "@/lib/studyMaterialExtraction";

// Same reasoning as the timetable upload route: extraction on a scanned
// document can take a while, so give this more room than the platform
// default before the function is killed.
export const maxDuration = 90;

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const courseId = req.nextUrl.searchParams.get("courseId");
    if (!courseId) {
      return NextResponse.json({ error: "Course ID required" }, { status: 400 });
    }

    const course = await prisma.course.findFirst({
      where: { id: courseId, semester: { userId: session.user.id } },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const materials = await prisma.studyMaterial.findMany({
      where: { courseId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(materials);
  } catch (error) {
    console.error("Error fetching study materials:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const courseId = formData.get("courseId") as string;

    if (!file || !courseId) {
      return NextResponse.json({ error: "File and course ID required" }, { status: 400 });
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF, JPEG, and PNG files are allowed" },
        { status: 400 }
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File is too large - please keep uploads under 4MB" },
        { status: 400 }
      );
    }

    const course = await prisma.course.findFirst({
      where: { id: courseId, semester: { userId: session.user.id } },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const fileType = file.type === "application/pdf" ? "pdf" : "image";
    const material = await prisma.studyMaterial.create({
      data: {
        userId: session.user.id,
        courseId,
        fileName: file.name,
        fileType,
        status: "processing",
      },
    });

    try {
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const extractedText = await extractStudyMaterialText(fileBuffer, file.type);

      const updated = await prisma.studyMaterial.update({
        where: { id: material.id },
        data: {
          status: extractedText ? "completed" : "failed",
          extractedText: extractedText || null,
          errorMessage: extractedText ? null : "No readable text found in this file",
        },
      });

      return NextResponse.json(updated, { status: 201 });
    } catch (extractionError) {
      console.error("Study material extraction error:", extractionError);
      const updated = await prisma.studyMaterial.update({
        where: { id: material.id },
        data: {
          status: "failed",
          errorMessage: "Could not read this file. Try a clearer scan or a different file.",
        },
      });
      return NextResponse.json(updated, { status: 201 });
    }
  } catch (error) {
    console.error("Error uploading study material:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Study material ID required" }, { status: 400 });
    }

    const existing = await prisma.studyMaterial.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Study material not found" }, { status: 404 });
    }

    await prisma.studyMaterial.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting study material:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
