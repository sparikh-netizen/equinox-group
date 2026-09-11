import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";

export async function sha256File(filePath: string): Promise<string> {
  const contents = await readFile(filePath);
  return createHash("sha256").update(contents).digest("hex");
}

export async function requireFile(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Required file is missing: ${filePath}`);
  }
}
