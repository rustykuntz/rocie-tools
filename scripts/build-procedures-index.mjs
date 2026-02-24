#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.argv[2] ? String(process.argv[2]) : process.cwd();
const procDir = join(repoRoot, "procedures");
const outPath = join(repoRoot, "procedures-index.json");

function parseProcedure(text) {
  const lines = text.split("\n");
  let name = "";
  let description = "";
  const skills = [];
  const credentials = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!name && line.startsWith("# ")) {
      name = line.slice(2).trim();
      continue;
    }
    if (name && !description && line && !line.startsWith("#")) {
      description = line;
      continue;
    }
    if (/^-\s*skills\s*:/i.test(line)) {
      const val = line.replace(/^-\s*skills\s*:\s*/i, "").trim();
      skills.push(...val.split(/,\s*/).filter(Boolean));
    }
    if (/^-\s*credentials\s*:/i.test(line)) {
      const val = line.replace(/^-\s*credentials\s*:\s*/i, "").trim();
      credentials.push(...val.split(/,\s*/).filter(Boolean));
    }
  }
  return { name, description, skills, credentials };
}

const files = readdirSync(procDir)
  .filter((f) => f.endsWith(".md") && f !== "procedure_template.md")
  .sort();

const items = files.map((file) => {
  const raw = readFileSync(join(procDir, file), "utf-8");
  const { name, description, skills, credentials } = parseProcedure(raw);
  return {
    name: name || file.replace(/\.md$/, ""),
    description: description || "No description.",
    path: relative(repoRoot, join(procDir, file)).replace(/\\/g, "/"),
    dependencies: { skills, credentials },
  };
});

const index = {
  generated_at: new Date().toISOString(),
  count: items.length,
  items,
};

writeFileSync(outPath, `${JSON.stringify(index, null, 2)}\n`, "utf-8");
console.log(`wrote ${outPath} (${items.length} procedures)`);
