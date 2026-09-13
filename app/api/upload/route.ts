import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const semesterId = formData.get("semesterId") as string;

    if (!file || !semesterId) {
      return NextResponse.json(
        { error: "File and semester ID required" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF, JPEG, and PNG files are allowed" },
        { status: 400 }
      );
    }

    // In production, you'd upload to cloud storage (Vercel Blob, S3, etc.)
    // For now, we'll just store the file info in the database
    const fileType = file.type === "application/pdf" ? "pdf" : "image";
    const upload = await prisma.timetableUpload.create({
      data: {
        semesterId,
        uploadUrl: `/uploads/${file.name}`,
        fileType: fileType,
        status: "processing",
      },
    });

    // Note: In production, you would:
    // 1. Upload the file to cloud storage
    // 2. Queue an OCR job
    // 3. Process the OCR result to extract timetable data
    // 4. Update the database with extracted timetable entries

    return NextResponse.json(
      {
        message: "File uploaded successfully",
        uploadId: upload.id,
        status: "File received. Manual entry is needed to create timetable.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
