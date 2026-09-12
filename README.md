# Equinox employee card generator

Production-quality business cards and employee ID cards generated directly from employee data. Illustrator is not required for everyday use or deployment.

## Browser app

The hosted generator runs entirely in the browser. Business-card details and ID-card portraits are not uploaded to a server; all PDFs and ZIP packages are created locally on the device.

Use the **Business card** and **ID card** tabs to switch products. The ID card workflow produces a one-sided 54 × 85 mm print PDF, converts the selected portrait to grayscale, and centre-crops it to the approved photo frame.

For local development:

```bash
npm ci
npm run web:dev
```

Create a production build with `npm run web:build`. GitHub Actions publishes `dist-web/` to GitHub Pages after every successful push to `main`.

The original approved artwork remains the visual source of truth. The generator preserves its static typography and positioning, removes the prior employee and QR data, then adds new employee text with embedded Manrope fonts and a new vector QR code containing the same canonical data.

The separate ID template follows its supplied reference exactly: Manrope ExtraBold for the employee name, Manrope Regular for all remaining text, CMYK artwork and text, and the original 54 × 85 mm geometry. Its variable fields are photo, name, title, employee ID, phone, blood group, emergency contact, and date of birth.

The QR matches the approved master contact fields: employee name, email, mobile number, office number, work address, company name, website, and title as a note. It uses a compact vCard 2.1 representation with medium error correction and supports QR codes up to the original 73 × 73 module capacity, so legitimate long names and titles can be generated without sacrificing the master QR's recovery level. Inputs that would exceed that master capacity are still rejected.

## Generate a card

Requirements:

- Node.js 22 or newer
- Poppler command-line tools: `pdftoppm`, `pdfinfo`, `pdftotext`, and `pdfimages`

On macOS:

```bash
brew install node poppler
npm ci
npm run generate -- --input ./data/example-employee.json
```

Generated files are written to `output/<employee-name>/`:

- `*-VisitingCard-PRINT.pdf` — authoritative print file with bleed and TrimBox
- `*.vcf` — the contact card encoded in the QR
- `*-QR.svg` — standalone vector QR
- `*-VisitingCard.svg` — editable/convenience vector version of the complete card
- `validation-report.json` — machine-readable preflight result
- `validation/` — 600 DPI reference, generated, and diff renders for visual inspection

The command exits non-zero if data is invalid, text overflows, dimensions change, employee text is missing, the rendered QR cannot be decoded, or any static pixel outside the intentional employee/QR regions differs from the approved artwork.

## Employee input

Create a JSON file with exactly these fields:

```json
{
  "firstName": "John",
  "lastName": "Smith",
  "jobTitle": "Director",
  "email": "john.smith@equinoxgroup.in",
  "mobile": "+91-90000-00000"
}
```

Names and titles are trimmed and Unicode-normalized. Email is lowercased. Phone numbers are validated and normalized into international E.164 form for the vCard; Indian mobile numbers are printed as `+91-12345-67890`.

## What is fixed

The canonical company details live in [`src/config.ts`](src/config.ts):

- Equinox Solutions Pvt. Ltd.
- `https://www.equinoxgroup.in`
- `+91-79-6920-8000`
- 101–103, North Tower, ONE42, B/h Ashok Vatika, Ambli Bopal Road, Bodakdev, Ahmedabad 380054, India

The approved production geometry is:

- Trim: 88.9 × 50.8 mm
- Bleed: 3 mm on every side
- PDF page: 94.9 × 56.8 mm
- Colour: inherited static CMYK artwork plus CMYK-generated employee text and QR

Change company or design constants only through a reviewed code change. After any layout change, regenerate a sample and have the printer approve a physical proof before a bulk run.

## Architecture

`template/static-template.pdf` and `template/id-static-template.pdf` are sanitized, approved production sources protected by SHA-256 checks. They contain only static company artwork—no previous employee text, portrait, personal metadata, Illustrator private data, or QR image.

Normal production generation uses only Git checkout contents plus Node and Poppler. It does not depend on this laptop, Illustrator, or any Adobe service. The original `.ai` and employee PDF are deliberately excluded from Git because they contain historical personal data and are not runtime inputs. Your original ZIP remains the private provenance and emergency design-edit source; an `.ai` file is never created per employee.

The print PDF is the authoritative output. The complete-card SVG is supplied for preview and interoperability, but browsers and vector editors may interpret colour management differently from a print PDF.

## Validation and development

```bash
npm run check
npm test
npm run build
npm run generate -- --input ./data/example-employee.json --verbose
```

The integration test renders the approved reference and generated PDF at 600 DPI, compares every pixel outside the employee and QR masks, extracts the generated text, reads page and TrimBox geometry, and independently decodes the QR from the rendered PDF.

If the design is replaced, rebuild the sanitized static template from the newly approved source in a private working copy, remove personal and Illustrator-private metadata, review its rendering, and then update the pinned production hash.

GitHub Actions runs type-checking, unit tests, a full 600 DPI integration preflight, compilation, and sample generation on every push and pull request.

## Deployment model

The browser app is a static GitHub Pages site. It has no application server or database: production inputs stay inside the employee's browser, while Git contains only the sanitized template, fonts, code, and non-personal example. The command-line generator can also run on any Linux or macOS machine with the listed requirements.

For each real employee:

1. Create the employee JSON outside the repository or in an ignored secure input location.
2. Run the generator and require `PASS`.
3. Open the generated 600 DPI preview and scan the QR with a phone.
4. Send the `*-PRINT.pdf` to the printer without scaling, using the embedded TrimBox and bleed.
5. Retain the validation report with the delivered print file.

Do not commit real employee records or generated output. Both can contain personal data.
