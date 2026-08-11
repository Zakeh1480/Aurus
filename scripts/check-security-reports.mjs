#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SEVERITY_ORDER = ['Info', 'Unknown', 'Low', 'Medium', 'High', 'Critical'];

const REPORT_FILES = [
  'gl-sast-report.json',
  'gl-secret-detection-report.json',
  'gl-dependency-scanning-report.json',
  'gl-container-scanning-report.json',
];

const ALLOWLIST_FILE = '.security-gate-allowlist.json';

function severityRank(severity) {
  const index = SEVERITY_ORDER.indexOf(severity);
  return index === -1 ? SEVERITY_ORDER.indexOf('Unknown') : index;
}

function loadAllowlist(projectDir) {
  const path = resolve(projectDir, ALLOWLIST_FILE);
  if (!existsSync(path)) {
    return new Set();
  }
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(raw)) {
    throw new Error(`${ALLOWLIST_FILE} deve ser um array de ids de vulnerabilidade`);
  }
  return new Set(raw);
}

function loadReport(projectDir, filename) {
  const path = resolve(projectDir, filename);
  if (!existsSync(path)) {
    console.log(`(skip) ${filename} não encontrado — job correspondente não rodou nesse pipeline`);
    return [];
  }
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const vulnerabilities = Array.isArray(raw.vulnerabilities) ? raw.vulnerabilities : [];
  console.log(`${filename}: ${vulnerabilities.length} achado(s) no relatório`);
  return vulnerabilities.map((v) => ({ ...v, _report: filename }));
}

function formatFinding(v) {
  const location = v.location?.file
    ? `${v.location.file}${v.location.start_line ? `:${v.location.start_line}` : ''}`
    : (v.location?.dependency?.package?.name ?? v.location?.image ?? '-');
  return `[${v.severity}] ${v._report} — ${v.name ?? v.message ?? v.id} (${location})`;
}

function main() {
  const projectDir = process.env.CI_PROJECT_DIR ?? process.cwd();
  const minSeverity = process.env.SECURITY_GATE_MIN_SEVERITY ?? 'High';
  const minRank = severityRank(minSeverity);

  const allowlist = loadAllowlist(projectDir);
  const all = REPORT_FILES.flatMap((filename) => loadReport(projectDir, filename));

  const allowlisted = all.filter((v) => v.id && allowlist.has(v.id));
  const belowThreshold = all.filter(
    (v) => !allowlisted.includes(v) && severityRank(v.severity) < minRank,
  );
  const failures = all.filter(
    (v) => !allowlisted.includes(v) && severityRank(v.severity) >= minRank,
  );

  if (allowlisted.length > 0) {
    console.log(`\n${allowlisted.length} achado(s) ignorado(s) via ${ALLOWLIST_FILE}.`);
  }
  console.log(
    `${belowThreshold.length} achado(s) abaixo do threshold "${minSeverity}" (informativo, não bloqueia).`,
  );

  if (failures.length === 0) {
    console.log(`\nNenhum achado >= "${minSeverity}" encontrado. Gate passou.`);
    return;
  }

  console.error(`\n${failures.length} achado(s) >= "${minSeverity}" — pipeline bloqueado:\n`);
  for (const finding of failures) {
    console.error(`  ${formatFinding(finding)}`);
  }
  console.error(
    `\nSe algum desses for falso positivo ou risco aceito, adicione o "id" da vulnerabilidade em ${ALLOWLIST_FILE} (ver docs/security-checklist.md).`,
  );
  process.exitCode = 1;
}

main();
