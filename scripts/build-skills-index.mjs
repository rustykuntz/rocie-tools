#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.argv[2] ? String(process.argv[2]) : process.cwd();
const skillsDir = join(repoRoot, "skills");
const outPath = join(repoRoot, "skills-index.json");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(path));
      continue;
    }
    if (entry.isFile() && entry.name === "SKILL.md") out.push(path);
  }
  return out;
}

function stripQuotes(value) {
  const text = String(value || "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: text };
  const data = {};
  const lines = m[1].split("\n");
  let inMetadata = false;
  for (const raw of lines) {
    const line = raw.replace(/\t/g, "  ");
    if (!line.trim()) continue;
    if (/^metadata\s*:\s*$/i.test(line.trim())) {
      inMetadata = true;
      continue;
    }
    const kv = line.match(/^\s*([a-zA-Z0-9_.-]+)\s*:\s*(.+)\s*$/);
    if (!kv) {
      inMetadata = false;
      continue;
    }
    const key = kv[1].trim();
    const value = stripQuotes(kv[2]);
    if (inMetadata) {
      data[`metadata.${key}`] = value;
    } else {
      data[key] = value;
    }
  }
  return { data, body: text.slice(m[0].length) };
}

function firstParagraph(body) {
  const lines = String(body || "").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith("```")) continue;
    return line;
  }
  return "";
}

function categoryAndName(filePath) {
  const rel = relative(skillsDir, filePath).replace(/\\/g, "/");
  const parts = rel.split("/");
  if (parts.length >= 3) return { category: parts[0], name: parts[1] };
  if (parts.length >= 2) return { category: "general", name: parts[0] };
  return { category: "general", name: "unknown" };
}

const files = walk(skillsDir);
const items = files.map((filePath) => {
  const raw = readFileSync(filePath, "utf-8");
  const { data, body } = parseFrontmatter(raw);
  const cn = categoryAndName(filePath);
  const name = String(data.name || cn.name || "").trim();
  const description = String(data.description || firstParagraph(body) || "No description.").trim();
  return {
    name,
    description,
    category: cn.category,
    path: relative(repoRoot, filePath).replace(/\\/g, "/"),
    homepage: String(data["metadata.homepage"] || "").trim() || null,
    source: String(data["metadata.source"] || "").trim() || null,
  };
}).sort((a, b) => a.name.localeCompare(b.name));

const index = {
  generated_at: new Date().toISOString(),
  count: items.length,
  items,
};

writeFileSync(outPath, `${JSON.stringify(index, null, 2)}\n`, "utf-8");
console.log(`wrote ${outPath} (${items.length} skills)`);
