import { normalizeEmployee, type EmployeeInput } from "../src/employee.js";
import { normalizeIdCardEmployee, type IdCardInput } from "../src/id-card.js";
import { generateQrSvg } from "../src/qr-core.js";
import { generateVCard } from "../src/vcard.js";
import { generateBrowserArtifacts, generateBrowserIdArtifacts, loadProductionAssets, type BrowserArtifacts, type BrowserIdArtifacts } from "./generator.js";
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
let idPhotoPreviewUrl: string | undefined;

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
    updateIdPreview(false);
  })
  .catch((error: unknown) => {
    setStatus(error instanceof Error ? error.message : "Could not load production assets", "error");
  });

const tabs = document.querySelectorAll<HTMLButtonElement>(".product-tab");
const workbenches = document.querySelectorAll<HTMLElement>("[data-workbench]");
for (const tab of tabs) {
  tab.addEventListener("click", () => {
    const view = tab.dataset.view;
    tabs.forEach((item) => item.setAttribute("aria-selected", String(item === tab)));
    workbenches.forEach((item) => { item.hidden = item.dataset.workbench !== view; });
  });
}

type IdDownloadKey = "pdf" | "photo" | "zip";
const idForm = requireElement<HTMLFormElement>("#id-form");
const idGenerateButton = requireElement<HTMLButtonElement>("#id-generate-button");
const idStatus = requireElement<HTMLElement>("#id-form-status");
const idDownloads = requireElement<HTMLElement>("#id-downloads");
const idPhotoInput = idForm.elements.namedItem("photo") as HTMLInputElement;
const idField = (name: keyof IdCardInput) => idForm.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
const idPhotoPreview = requireElement<HTMLElement>("#id-photo-preview");
const idPreview = {
  name: requireElement<HTMLElement>("#id-preview-name"),
  title: requireElement<HTMLElement>("#id-preview-title-text"),
  employee: requireElement<HTMLElement>("#id-preview-employee"),
  phone: requireElement<HTMLElement>("#id-preview-phone"),
  blood: requireElement<HTMLElement>("#id-preview-blood"),
  emergency: requireElement<HTMLElement>("#id-preview-emergency"),
  dob: requireElement<HTMLElement>("#id-preview-dob"),
};
const idLinks: Record<IdDownloadKey, HTMLAnchorElement> = {
  pdf: requireElement<HTMLAnchorElement>("#id-download-pdf"),
  photo: requireElement<HTMLAnchorElement>("#id-download-photo"),
  zip: requireElement<HTMLAnchorElement>("#id-download-all"),
};

function readIdInput(): IdCardInput {
  return {
    firstName: idField("firstName").value,
    lastName: idField("lastName").value,
    jobTitle: idField("jobTitle").value,
    employeeId: idField("employeeId").value,
    mobile: idField("mobile").value,
    bloodGroup: idField("bloodGroup").value as IdCardInput["bloodGroup"],
    emergencyContact: idField("emergencyContact").value,
    dateOfBirth: idField("dateOfBirth").value,
  };
}

function setIdStatus(message: string, tone: "neutral" | "success" | "error" = "neutral"): void {
  idStatus.textContent = message;
  idStatus.dataset.tone = tone;
}

function friendlyDob(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return "Date of birth";
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date).replace(/ /gu, "-");
}

function updateIdPreview(announce = true): void {
  const input = readIdInput();
  idPreview.name.textContent = `${input.firstName} ${input.lastName}`.trim() || "Employee name";
  idPreview.title.textContent = input.jobTitle || "Title";
  idPreview.employee.textContent = `Employee ID: ${input.employeeId || "—"}`;
  idPreview.phone.textContent = `Phone:${input.mobile || "—"}`;
  idPreview.blood.textContent = `Blood Group: ${input.bloodGroup || "—"}`;
  idPreview.emergency.textContent = `Emergency Contact: ${input.emergencyContact || "—"}`;
  idPreview.dob.textContent = `DOB: ${friendlyDob(input.dateOfBirth)}`;

  const photo = idPhotoInput.files?.[0];
  if (idPhotoPreviewUrl) URL.revokeObjectURL(idPhotoPreviewUrl);
  idPhotoPreviewUrl = photo ? URL.createObjectURL(photo) : undefined;
  idPhotoPreview.replaceChildren(photo
    ? Object.assign(document.createElement("img"), { src: idPhotoPreviewUrl, alt: "Employee portrait preview" })
    : Object.assign(document.createElement("span"), { textContent: "PHOTO" }));
  try {
    const employee = normalizeIdCardEmployee(input);
    idPreview.phone.textContent = `Phone:${employee.displayMobile}`;
    idPreview.emergency.textContent = `Emergency Contact: ${employee.displayEmergencyContact}`;
    idPreview.dob.textContent = `DOB: ${employee.displayDateOfBirth}`;
    if (!photo) throw new Error("Choose an employee photo to continue.");
    idGenerateButton.disabled = !assetsReady;
    if (assetsReady && announce) setIdStatus("Details and photo are valid. Ready to generate.");
  } catch (error) {
    idGenerateButton.disabled = true;
    if (announce) setIdStatus(error instanceof Error ? error.message : "Complete all required ID fields.", "error");
  }
}

function showIdDownloads(artifacts: BrowserIdArtifacts): void {
  for (const key of Object.keys(idLinks) as IdDownloadKey[]) {
    const file = artifacts.files[key];
    const url = URL.createObjectURL(file.blob);
    downloadUrls.add(url);
    idLinks[key].href = url;
    idLinks[key].download = file.name;
  }
  idDownloads.hidden = false;
}

async function createIdArtifacts(): Promise<void> {
  const photo = idPhotoInput.files?.[0];
  if (!photo) return setIdStatus("Choose an employee photo to continue.", "error");
  idGenerateButton.disabled = true;
  idGenerateButton.dataset.busy = "true";
  idGenerateButton.textContent = "Generating…";
  idDownloads.hidden = true;
  setIdStatus("Building the ID print package in this browser…");
  try {
    const artifacts = await generateBrowserIdArtifacts(readIdInput(), photo);
    showIdDownloads(artifacts);
    setIdStatus(`ID package ready for ${artifacts.employee.fullName}.`, "success");
  } catch (error) {
    setIdStatus(error instanceof Error ? error.message : "Generation failed", "error");
  } finally {
    idGenerateButton.dataset.busy = "false";
    idGenerateButton.textContent = "Generate ID print files";
    updateIdPreview(false);
  }
}

idForm.addEventListener("input", () => { idDownloads.hidden = true; updateIdPreview(); });
idForm.addEventListener("submit", (event) => { event.preventDefault(); void createIdArtifacts(); });
updateIdPreview(false);

window.addEventListener("beforeunload", () => {
  clearDownloadUrls();
  if (qrUrl) URL.revokeObjectURL(qrUrl);
  if (idPhotoPreviewUrl) URL.revokeObjectURL(idPhotoPreviewUrl);
});
