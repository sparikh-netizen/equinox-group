import { readFile, writeFile } from "node:fs/promises";
import { PDFDocument, PDFName } from "pdf-lib";

const [, , sourcePath, outputPath, overlayPath] = process.argv;
if (!sourcePath || !outputPath || !overlayPath) {
  throw new Error("Usage: node scripts/build-id-template.mjs <qdf-reference.pdf> <base-output.pdf> <top-overlay.pdf>");
}

const source = (await readFile(sourcePath)).toString("latin1");
const pageStreamMatch = source.match(/%% Contents for page 1[\s\S]*?stream\n([\s\S]*?)\nendstream/);
if (!pageStreamMatch) throw new Error("Could not find the decoded first-page content stream");

const content = pageStreamMatch[1];
const brandColor = "1 0.914 0.25 0.082 k";
const bottomStart = content.indexOf(brandColor);
const bottomEnd = content.indexOf("\nBT", bottomStart);
const topStart = content.lastIndexOf("q\n0 240.945 153.071 -240.945 re");
const topEnd = content.indexOf("\nEMC", topStart);
if (bottomStart < 0 || bottomEnd < 0 || topStart < 0 || topEnd < 0) {
  throw new Error("The expected Equinox logo paths were not found in the reference");
}

const bottomLogo = content.slice(bottomStart, bottomEnd);
const topLogo = `${content.slice(topStart, topEnd)}\nQ`;
const staticContent = [
  "0 0 0 0 k",
  "0 0 153.071 240.945 re",
  "f",
  bottomLogo,
].join("\n");

async function createPdf(title, subject, pageContent) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([153.071, 240.945]);
  const stream = pdf.context.flateStream(pageContent);
  page.node.set(PDFName.of("Contents"), pdf.context.register(stream));
  pdf.setTitle(title);
  pdf.setAuthor("Equinox Solutions Pvt. Ltd.");
  pdf.setSubject(subject);
  pdf.setCreator("Equinox ID Card Generator");
  pdf.setProducer("pdf-lib");
  pdf.setCreationDate(new Date("2026-01-01T00:00:00.000Z"));
  pdf.setModificationDate(new Date("2026-01-01T00:00:00.000Z"));
  pdf.catalog.delete(PDFName.of("Metadata"));
  return pdf.save({ useObjectStreams: false });
}

await Promise.all([
  writeFile(outputPath, await createPdf("Equinox ID Card Static Template", "Non-personal base artwork for the Equinox employee ID card generator", staticContent)),
  writeFile(overlayPath, await createPdf("Equinox ID Card Logo Overlay", "Non-personal top logo artwork for the Equinox employee ID card generator", topLogo)),
]);
