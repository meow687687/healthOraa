import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const MEDICAL_RECORDS_BUCKET = "medical-records";
const DEMO_PATIENT_ID = "22222222-2222-2222-2222-222222222222";

const SAMPLE_RECORDS = [
  {
    id: "abababab-0000-4000-8000-000000000011",
    path: `${DEMO_PATIENT_ID}/health-locker/metabolic-panel-2026-10-15.pdf`,
    title: "Comprehensive Metabolic Panel & HbA1c",
    metadata: {
      demo_only: true,
      hba1c: 6.1,
      fasting_glucose: 104,
      tsh: 3.8,
      ldl_cholesterol: 128,
    },
  },
  {
    id: "abababab-0000-4000-8000-000000000012",
    path: `${DEMO_PATIENT_ID}/health-locker/pelvic-ultrasound-2026-09-20.pdf`,
    title: "Pelvic Ultrasound Report",
    metadata: { demo_only: true },
  },
  {
    id: "abababab-0000-4000-8000-000000000013",
    path: `${DEMO_PATIENT_ID}/health-locker/dermatology-prescription-2026-11-02.pdf`,
    title: "Signed Dermatology Prescription",
    metadata: { demo_only: true },
  },
];

const parseStatusEnv = (output) => {
  const values = new Map();
  for (const line of output.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        value = value.slice(1, -1);
      }
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    values.set(name, value);
  }
  return values;
};

const readLocalSupabase = () => {
  const result = spawnSync(
    "pnpm",
    ["exec", "supabase", "status", "-o", "env"],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: 30_000,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      "Start the local Supabase stack before seeding demo files.",
    );
  }

  const values = parseStatusEnv(result.stdout ?? "");
  const apiUrl = values.get("API_URL");
  const serviceRoleKey = values.get("SERVICE_ROLE_KEY");
  if (!apiUrl || !serviceRoleKey) {
    throw new Error(
      "Local Supabase did not return its API URL and service-role key.",
    );
  }

  const parsedUrl = new URL(apiUrl);
  if (
    parsedUrl.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname)
  ) {
    throw new Error(
      "Demo files can only be seeded into a loopback Supabase instance.",
    );
  }

  return { apiUrl: parsedUrl.origin, serviceRoleKey };
};

const escapePdfText = (text) =>
  text
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replace(/[^\x20-\x7e]/g, "?");

const createDemoPdf = (title) => {
  const lines = [
    "SYNTHETIC DEMO DOCUMENT",
    title,
    "For Healthoraa software demonstration only.",
    "This is not a real medical record or clinical result.",
    "It contains no patient information or medical advice.",
  ];
  const operations = [
    "BT",
    "/F1 18 Tf",
    "52 740 Td",
    `(${escapePdfText(lines[0])}) Tj`,
    "/F1 12 Tf",
  ];
  for (const line of lines.slice(1)) {
    operations.push("0 -34 Td", `(${escapePdfText(line)}) Tj`);
  }
  operations.push("ET");
  const stream = `${operations.join("\n")}\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
};

const seedDemoStorage = async () => {
  const { apiUrl, serviceRoleKey } = readLocalSupabase();
  for (const record of SAMPLE_RECORDS) {
    const objectPath = record.path.split("/").map(encodeURIComponent).join("/");
    const pdf = createDemoPdf(record.title);
    const response = await fetch(
      `${apiUrl}/storage/v1/object/${MEDICAL_RECORDS_BUCKET}/${objectPath}`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          "content-type": "application/pdf",
          "x-upsert": "true",
        },
        redirect: "error",
        body: pdf,
      },
    );
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Local demo file upload failed (${response.status}).`);
    }

    const metadataParams = new URLSearchParams({
      id: `eq.${record.id}`,
      patient_id: `eq.${DEMO_PATIENT_ID}`,
      file_path: `eq.${record.path}`,
      select: "id,patient_id,file_path",
    });
    const metadataResponse = await fetch(
      `${apiUrl}/rest/v1/patient_documents?${metadataParams}`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          "content-type": "application/json",
          prefer: "return=representation",
        },
        redirect: "error",
        body: JSON.stringify({
          extracted_metadata: record.metadata,
          file_size_bytes: pdf.byteLength,
        }),
      },
    );
    if (!metadataResponse.ok) {
      throw new Error(
        `Local demo record labeling failed (${metadataResponse.status}).`,
      );
    }
    const updatedRows = await metadataResponse.json();
    if (
      !Array.isArray(updatedRows) ||
      updatedRows.length !== 1 ||
      updatedRows[0]?.id !== record.id ||
      updatedRows[0]?.patient_id !== DEMO_PATIENT_ID ||
      updatedRows[0]?.file_path !== record.path
    ) {
      throw new Error(
        "Local demo record labeling did not match one seeded row.",
      );
    }
  }
  console.log(
    `Seeded ${SAMPLE_RECORDS.length} synthetic PDFs and labels in the private ${MEDICAL_RECORDS_BUCKET} bucket.`,
  );
};

seedDemoStorage().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Local demo storage seeding failed.",
  );
  process.exitCode = 1;
});
