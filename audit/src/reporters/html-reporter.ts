/**
 * HTML Reporter
 * Generates HTML reports for audit results
 */

import * as fs from 'fs';
import { AuditReport, PackageAuditResult } from '../types';

/**
 * Calculate documentation completeness percentage
 */
function calculateCompleteness(result: PackageAuditResult): number {
  if (!result.documentation || result.documentation.exports.length === 0) {
    return 100;
  }
  const documented = result.documentation.exports.filter(
    (e) => e.isDocumented
  ).length;
  return Math.round((documented / result.documentation.exports.length) * 100);
}

/**
 * Count undocumented exports
 */
function countUndocumented(result: PackageAuditResult): number {
  if (!result.documentation) return 0;
  return result.documentation.exports.filter((e) => !e.isDocumented).length;
}

/**
 * Count exports missing examples
 */
function countMissingExamples(result: PackageAuditResult): number {
  if (!result.documentation) return 0;
  return result.documentation.exports
    .filter((e) => e.type === 'class' || e.type === 'function')
    .filter((e) => !e.hasExample).length;
}

/**
 * Generate HTML for a package report
 */
export function generatePackageHtml(result: PackageAuditResult): string {
  const issuesHtml = result.issues
    ? result.issues
        .map(
          (issue) => `
        <div class="issue ${issue.severity}">
          <div class="issue-header">
            <span class="issue-type">${issue.type}</span>
            <span class="issue-severity">${issue.severity}</span>
          </div>
          <div class="issue-message">${escapeHtml(issue.message)}</div>
          ${
            issue.location
              ? `<div class="issue-location">Location: ${escapeHtml(
                  typeof issue.location === 'string'
                    ? issue.location
                    : `${issue.location.file}:${issue.location.line}`
                )}</div>`
              : ''
          }
          ${
            issue.recommendation
              ? `<div class="issue-recommendation">${escapeHtml(
                  issue.recommendation
                )}</div>`
              : ''
          }
        </div>
      `
        )
        .join('')
    : '<p class="no-issues">No issues found!</p>';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Audit Report - ${escapeHtml(result.packageName)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: #2c3e50;
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0 0 10px 0;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .metric-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .metric-card h3 {
      margin: 0 0 15px 0;
      color: #2c3e50;
    }
    .metric-value {
      font-size: 2em;
      font-weight: bold;
      color: #3498db;
    }
    .issues-section {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .issue {
      border-left: 4px solid #e74c3c;
      padding: 15px;
      margin-bottom: 15px;
      background: #fff5f5;
    }
    .issue.warning {
      border-left-color: #f39c12;
      background: #fffbf0;
    }
    .issue.info {
      border-left-color: #3498db;
      background: #f0f8ff;
    }
    .issue-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .issue-type {
      font-weight: bold;
      color: #2c3e50;
    }
    .issue-severity {
      text-transform: uppercase;
      font-size: 0.8em;
      padding: 2px 8px;
      border-radius: 3px;
      background: #e74c3c;
      color: white;
    }
    .issue.warning .issue-severity {
      background: #f39c12;
    }
    .issue.info .issue-severity {
      background: #3498db;
    }
    .issue-message {
      margin-bottom: 10px;
    }
    .issue-location {
      font-size: 0.9em;
      color: #7f8c8d;
      font-family: monospace;
    }
    .issue-recommendation {
      margin-top: 10px;
      padding: 10px;
      background: rgba(255,255,255,0.5);
      border-radius: 4px;
      font-size: 0.9em;
    }
    .no-issues {
      text-align: center;
      color: #27ae60;
      font-size: 1.2em;
      padding: 40px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Audit Report</h1>
    <h2>${escapeHtml(result.packageName)}</h2>
  </div>

  <div class="metrics">
    ${
      result.documentation
        ? `
    <div class="metric-card">
      <h3>Documentation</h3>
      <div class="metric-value">${calculateCompleteness(result).toFixed(
        1
      )}%</div>
      <p>Undocumented: ${countUndocumented(result)}</p>
      <p>Missing Examples: ${countMissingExamples(result)}</p>
    </div>
    `
        : ''
    }
    ${
      result.coverage
        ? `
    <div class="metric-card">
      <h3>Test Coverage</h3>
      <div class="metric-value">${
        result.coverage.statements?.percentage.toFixed(1) || 0
      }%</div>
      <p>Statements: ${
        result.coverage.statements?.percentage.toFixed(1) || 0
      }%</p>
      <p>Branches: ${result.coverage.branches?.percentage.toFixed(1) || 0}%</p>
      <p>Functions: ${
        result.coverage.functions?.percentage.toFixed(1) || 0
      }%</p>
    </div>
    `
        : ''
    }
    <div class="metric-card">
      <h3>Issues</h3>
      <div class="metric-value">${result.issues?.length || 0}</div>
      <p>Critical: ${
        result.issues?.filter((i) => i.severity === 'critical').length || 0
      }</p>
      <p>Warnings: ${
        result.issues?.filter((i) => i.severity === 'warning').length || 0
      }</p>
    </div>
  </div>

  <div class="issues-section">
    <h2>Issues</h2>
    ${issuesHtml}
  </div>
</body>
</html>
  `;
}

/**
 * Generate HTML for full audit report
 */
export function generateFullHtml(report: AuditReport): string {
  const packagesHtml = report.packages
    .map(
      (pkg) => `
    <div class="package-card">
      <h3>${escapeHtml(pkg.packageName)}</h3>
      <div class="package-metrics">
        ${
          pkg.documentation
            ? `<span>Docs: ${calculateCompleteness(pkg).toFixed(1)}%</span>`
            : ''
        }
        ${
          pkg.coverage
            ? `<span>Coverage: ${
                pkg.coverage.statements?.percentage.toFixed(1) || 0
              }%</span>`
            : ''
        }
        <span class="issue-count ${
          pkg.issues && pkg.issues.length > 0 ? 'has-issues' : ''
        }">
          ${pkg.issues?.length || 0} issues
        </span>
      </div>
    </div>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Express Suite Audit Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 2.5em;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }
    .summary-card h3 {
      margin: 0 0 10px 0;
      color: #7f8c8d;
      font-size: 0.9em;
      text-transform: uppercase;
    }
    .summary-value {
      font-size: 2.5em;
      font-weight: bold;
      color: #2c3e50;
    }
    .packages-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    .package-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: transform 0.2s;
    }
    .package-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    .package-card h3 {
      margin: 0 0 15px 0;
      color: #2c3e50;
    }
    .package-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .package-metrics span {
      padding: 5px 10px;
      background: #ecf0f1;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .issue-count.has-issues {
      background: #e74c3c;
      color: white;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Express Suite Audit Report</h1>
    <p>${new Date(report.timestamp).toLocaleString()}</p>
  </div>

  <div class="summary">
    <div class="summary-card">
      <h3>Total Packages</h3>
      <div class="summary-value">${report.summary.totalPackages}</div>
    </div>
    <div class="summary-card">
      <h3>Documentation Score</h3>
      <div class="summary-value">${report.summary.overallDocumentationScore.toFixed(
        1
      )}%</div>
    </div>
    <div class="summary-card">
      <h3>Coverage Score</h3>
      <div class="summary-value">${report.summary.overallCoverageScore.toFixed(
        1
      )}%</div>
    </div>
    <div class="summary-card">
      <h3>Critical Issues</h3>
      <div class="summary-value" style="color: #e74c3c;">${
        report.summary.criticalIssues
      }</div>
    </div>
  </div>

  <h2>Packages</h2>
  <div class="packages-grid">
    ${packagesHtml}
  </div>
</body>
</html>
  `;
}

/**
 * Save package report to HTML file
 */
export function savePackageReport(
  result: PackageAuditResult,
  outputPath: string
): void {
  const html = generatePackageHtml(result);
  fs.writeFileSync(outputPath, html, 'utf-8');
}

/**
 * Save full audit report to HTML file
 */
export function saveFullReport(report: AuditReport, outputPath: string): void {
  const html = generateFullHtml(report);
  fs.writeFileSync(outputPath, html, 'utf-8');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
