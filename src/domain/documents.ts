import { fileTypeFromBuffer } from "file-type";
import { basename } from "node:path";

const supported = new Map([
  ["application/pdf", ".pdf"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
]);
export function safeFilename(input: string): string {
  const clean = basename(input).normalize("NFKC").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180);
  return clean || "upload";
}
export async function validateUpload(buffer: Buffer, claimedName: string, maxBytes: number): Promise<{ mediaType: string; filename: string }> {
  if (buffer.length === 0 || buffer.length > maxBytes) throw new Error("File is empty or exceeds the configured limit");
  const filename = safeFilename(claimedName);
  const detected = await fileTypeFromBuffer(buffer);
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  if (ext === ".csv") {
    if (buffer.includes(0)) throw new Error("Invalid CSV content");
    return { mediaType: "text/csv", filename };
  }
  if (!detected || !supported.has(detected.mime) || supported.get(detected.mime) !== ext) throw new Error("File content does not match a supported type");
  return { mediaType: detected.mime, filename };
}
export type DocumentState = "processing"|"review"|"approved"|"rejected"|"archived"|"failed";
export function canTransitionDocument(from: DocumentState, to: DocumentState): boolean {
  const allowed: Record<DocumentState, DocumentState[]> = {
    processing: ["review", "failed"], review: ["approved", "rejected"], approved: ["archived"],
    rejected: ["archived"], archived: [], failed: ["processing", "archived"],
  };
  return allowed[from].includes(to);
}
