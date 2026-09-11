import { normalizeEmployee, type EmployeeInput } from "../src/employee.js";
import { generateQrSvg } from "../src/qr-core.js";
import { generateVCard } from "../src/vcard.js";
import { generateBrowserArtifacts, loadProductionAssets, type BrowserArtifacts } from "./generator.js";
import "./styles.css";

type DownloadKey = "pdf" | "vcf" | "qr" | "cardSvg" | "zip";

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Generator interface is missing ${selector}`);
  return element;
}

const form = requireElement<HTMLFormElement>("#employee-form");
const generateButton = requireElement<HTMLButtonElement>("#generate-button");
const status = requireElement<HTMLElement>("#form-status");
const downloads = requireElement<HTMLElement>("#downloads");
const qrPreview = requireElement<HTMLElement>("#qr-preview");

const field = (name: keyof EmployeeInput) => form.elements.namedItem(name) as HTMLInputElement;
const preview = {
  name: document.querySelector<HTMLElement>("#preview-name"),
  title: document.querySelector<HTMLElement>("#preview-title-text"),
  email: document.querySelector<HTMLElement>("#preview-email"),
  phone: document.querySelector<HTMLElement>("#preview-phone"),
};
const links: Record<DownloadKey, HTMLAnchorElement> = {
  pdf: document.querySelector<HTMLAnchorElement>("#download-pdf")!,
  vcf: document.querySelector<HTMLAnchorElement>("#download-vcf")!,
  qr: document.querySelector<HTMLAnchorElement>("#download-qr")!,
  cardSvg: document.querySelector<HTMLAnchorElement>("#download-svg")!,
  zip: document.querySelector<HTMLAnchorElement>("#download-all")!,
};
const downloadUrls = new Set<string>();
let qrUrl: string | undefined;
let assetsReady = false;

function readInput(): EmployeeInput {
  return {
    firstName: field("firstName").value,
    lastName: field("lastName").value,
    jobTitle: field("jobTitle").value,
    email: field("email").value,
    mobile: field("mobile").value,
  };
}

function setStatus(message: string, tone: "neutral" | "success" | "error" = "neutral"): void {
  status.textContent = message;
  status.dataset.tone = tone;
}

function updatePreview(announce = true): void {
  const input = readInput();
  if (preview.name) preview.name.textContent = `${input.firstName} ${input.lastName}`.trim() || "Employee name";
  if (preview.title) preview.title.textContent = input.jobTitle || "Title";
  if (preview.email) preview.email.textContent = input.email || "email@equinoxgroup.in";
  if (preview.phone) preview.phone.textContent = input.mobile || "+91-00000-00000";

  try {
    const employee = normalizeEmployee(input);
    if (preview.phone) preview.phone.textContent = employee.displayMobile;
    const qrSvg = generateQrSvg(generateVCard(employee));
    if (qrUrl) URL.revokeObjectURL(qrUrl);
    qrUrl = URL.createObjectURL(new Blob([qrSvg], { type: "image/svg+xml" }));
    qrPreview.replaceChildren(Object.assign(document.createElement("img"), { src: qrUrl, alt: "Employee contact QR code" }));
    if (assetsReady) {
      generateButton.disabled = false;
      if (announce) setStatus("Details are valid. Ready to generate.");
    }
  } catch {
    qrPreview.replaceChildren(Object.assign(document.createElement("span"), { textContent: "QR" }));
    generateButton.disabled = true;
    if (assetsReady && announce) setStatus("Complete all fields with a valid email and phone number.");
  }
}

function clearDownloadUrls(): void {
  for (const url of downloadUrls) URL.revokeObjectURL(url);
  downloadUrls.clear();
}

function showDownloads(artifacts: BrowserArtifacts): void {
  clearDownloadUrls();
  for (const key of Object.keys(links) as DownloadKey[]) {
    const file = artifacts.files[key];
    const url = URL.createObjectURL(file.blob);
    downloadUrls.add(url);
    links[key].href = url;
    links[key].download = file.name;
  }
  downloads.hidden = false;
}

async function createArtifacts(input = readInput()): Promise<BrowserArtifacts> {
  generateButton.disabled = true;
  generateButton.dataset.busy = "true";
  generateButton.textContent = "Generating…";
  downloads.hidden = true;
  setStatus("Building the print package in this browser…");
  try {
    const artifacts = await generateBrowserArtifacts(input);
    showDownloads(artifacts);
    setStatus(`Package ready for ${artifacts.employee.fullName}.`, "success");
    return artifacts;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    setStatus(message, "error");
    throw error;
  } finally {
    generateButton.dataset.busy = "false";
    generateButton.textContent = "Generate print files";
    updatePreview(false);
  }
}

form.addEventListener("input", () => {
  downloads.hidden = true;
  updatePreview();
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  void createArtifacts().catch(() => undefined);
});

interface ModelContext {
  registerTool(tool: {
    name: string;
    title: string;
    description: string;
    inputSchema: object;
    annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
    execute(input: unknown): Promise<unknown>;
  }): void | Promise<void>;
}

const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
if (modelContext?.registerTool) {
  void Promise.resolve(
    modelContext.registerTool({
      name: "generate_business_card",
      title: "Generate business card",
      description: "Validate employee details and prepare the Equinox print PDF, vCard, QR SVG, card SVG, and ZIP download in the visible page.",
      inputSchema: {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          jobTitle: { type: "string" },
          email: { type: "string" },
          mobile: { type: "string" },
        },
        required: ["firstName", "lastName", "jobTitle", "email", "mobile"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(rawInput) {
        const input = rawInput as EmployeeInput;
        const employee = normalizeEmployee(input);
        field("firstName").value = employee.firstName;
        field("lastName").value = employee.lastName;
        field("jobTitle").value = employee.jobTitle;
        field("email").value = employee.email;
        field("mobile").value = employee.displayMobile;
        updatePreview();
        const result = await createArtifacts(input);
        return { status: "ready", employee: result.employee.fullName, package: result.files.zip.name };
      },
    }),
  ).catch(() => undefined);
}

setStatus("Loading approved production assets…");
updatePreview();
void loadProductionAssets()
  .then(() => {
    assetsReady = true;
    updatePreview();
  })
  .catch((error: unknown) => {
    setStatus(error instanceof Error ? error.message : "Could not load production assets", "error");
  });

window.addEventListener("beforeunload", () => {
  clearDownloadUrls();
  if (qrUrl) URL.revokeObjectURL(qrUrl);
});
