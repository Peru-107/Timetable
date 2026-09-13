import Tesseract from "tesseract.js";

export async function extractTextFromImage(imagePath: string): Promise<string> {
  try {
    const result = await Tesseract.recognize(imagePath, "eng", {
      logger: (m) => console.log(m),
    });

    return result.data.text;
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to extract text from image");
  }
}

export async function extractTextFromPDF(pdfPath: string): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    const pdf = await pdfjsLib.getDocument(pdfPath).promise;

    let text = "";
    for (let i = 0; i < pdf.numPages; i++) {
      const page = await pdf.getPage(i + 1);
      const textContent = await page.getTextContent();
      text += textContent.items.map((item: any) => item.str).join(" ");
    }

    return text;
  } catch (error) {
    console.error("PDF Extraction Error:", error);
    throw new Error("Failed to extract text from PDF");
  }
}
