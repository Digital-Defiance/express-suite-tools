/**
 * JSON Reporter
 * Outputs audit results as JSON for programmatic consumption
 */

import * as fs from 'fs';
import { AuditReport, PackageAuditResult } from '../types';

/**
 * Generate JSON report for a package
 */
export function generatePackageJson(result: PackageAuditResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Generate JSON report for full audit
 */
export function generateFullJson(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Save package report to JSON file
 */
export function savePackageReport(
  result: PackageAuditResult,
  outputPath: string
): void {
  const json = generatePackageJson(result);
  fs.writeFileSync(outputPath, json, 'utf-8');
}

/**
 * Save full audit report to JSON file
 */
export function saveFullReport(report: AuditReport, outputPath: string): void {
  const json = generateFullJson(report);
  fs.writeFileSync(outputPath, json, 'utf-8');
}

/**
 * Parse JSON report from file
 */
export function loadReport(filePath: string): AuditReport {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as AuditReport;
}
