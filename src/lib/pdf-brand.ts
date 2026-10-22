import path from "node:path";

/** The brand in the PDFs: Geist, the neutral grays and the violet (anuntech-brand tokens). */
export const PDF_COLORS = {
  ink: "#0d0d0d",
  text: "#262626",
  muted: "#6b6b6b",
  faint: "#8a8a8a",
  line: "#e5e5e5",
  soft: "#f6f6f6",
  violet: "#5b43f0",
  onInk: "#a3a3a3",
} as const;

const assets = () => path.join(process.cwd(), "assets");
export const pdfFonts = () => {
  const fonts = path.join(assets(), "fonts");
  return {
    regular: path.join(fonts, "Geist-Regular.ttf"),
    bold: path.join(fonts, "Geist-SemiBold.ttf"),
    mono: path.join(fonts, "GeistMono-Regular.ttf"),
  };
};

/** Registers Regular, Bold and Mono on the document. */
export function registerPdfFonts(doc: PDFKit.PDFDocument) {
  const fonts = pdfFonts();
  doc.registerFont("Regular", fonts.regular);
  doc.registerFont("Bold", fonts.bold);
  doc.registerFont("Mono", fonts.mono);
}

/** The horizontal logo at the top left, then a line under it; leaves the cursor below. */
export function pdfHeader(doc: PDFKit.PDFDocument, left: number, width: number) {
  const top = doc.y;
  doc.image(path.join(assets(), "brand/lockup-preto.png"), left, top, { height: 20 });
  doc.moveTo(left, top + 36).lineTo(left + width, top + 36).lineWidth(0.75).strokeColor(PDF_COLORS.line).stroke();
  doc.x = left;
  doc.y = top + 52;
}
