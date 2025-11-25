/**
 * Console Reporter
 * Outputs audit results to the console with colored formatting
 */

import chalk from 'chalk';
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
 * Generate a console report for a single package
 */
export function generatePackageReport(result: PackageAuditResult): string {
  let output = '';

  output += chalk.bold.blue(`\n${'='.repeat(60)}\n`);
  output += chalk.bold.blue(`Package: ${result.packageName}\n`);
  output += chalk.bold.blue(`${'='.repeat(60)}\n\n`);

  // Documentation section
  if (result.documentation) {
    output += chalk.bold('Documentation:\n');
    output += `  Completeness: ${calculateCompleteness(result).toFixed(1)}%\n`;
    output += `  Undocumented Exports: ${countUndocumented(result)}\n`;
    output += `  Missing Examples: ${countMissingExamples(result)}\n\n`;
  }

  // Coverage section
  if (result.coverage) {
    output += chalk.bold('Test Coverage:\n');
    output += `  Statements: ${
      result.coverage.statements?.percentage.toFixed(1) || 0
    }%\n`;
    output += `  Branches: ${
      result.coverage.branches?.percentage.toFixed(1) || 0
    }%\n`;
    output += `  Functions: ${
      result.coverage.functions?.percentage.toFixed(1) || 0
    }%\n`;
    output += `  Lines: ${
      result.coverage.lines?.percentage.toFixed(1) || 0
    }%\n\n`;
  }

  // Issues section
  if (result.issues && result.issues.length > 0) {
    output += chalk.bold.red(`Issues (${result.issues.length}):\n`);
    for (const issue of result.issues.slice(0, 10)) {
      const icon = issue.severity === 'critical' ? '❌' : '⚠️ ';
      output += `  ${icon} ${issue.message}\n`;
      if (issue.location) {
        output += chalk.gray(`     Location: ${issue.location}\n`);
      }
    }
    if (result.issues.length > 10) {
      output += chalk.gray(
        `  ... and ${result.issues.length - 10} more issues\n`
      );
    }
    output += '\n';
  } else {
    output += chalk.green('✅ No issues found!\n\n');
  }

  return output;
}

/**
 * Generate a console report for the full audit
 */
export function generateFullReport(report: AuditReport): string {
  let output = '';

  output += chalk.bold.cyan(`\n${'='.repeat(60)}\n`);
  output += chalk.bold.cyan(`Express Suite Audit Report\n`);
  output += chalk.bold.cyan(`${new Date(report.timestamp).toLocaleString()}\n`);
  output += chalk.bold.cyan(`${'='.repeat(60)}\n\n`);

  // Summary
  output += chalk.bold('Summary:\n');
  output += `  Total Packages: ${report.summary.totalPackages}\n`;
  output += `  Packages with Issues: ${report.summary.packagesWithIssues}\n`;
  output += `  Overall Documentation Score: ${report.summary.overallDocumentationScore.toFixed(
    1
  )}%\n`;
  output += `  Overall Coverage Score: ${report.summary.overallCoverageScore.toFixed(
    1
  )}%\n`;
  output += `  Critical Issues: ${chalk.red(report.summary.criticalIssues)}\n`;
  output += `  Warnings: ${chalk.yellow(report.summary.warnings)}\n\n`;

  // Package details
  output += chalk.bold('Package Details:\n\n');
  for (const pkg of report.packages) {
    const status =
      pkg.issues && pkg.issues.length > 0 ? chalk.red('❌') : chalk.green('✅');
    output += `${status} ${pkg.packageName}\n`;
    if (pkg.issues && pkg.issues.length > 0) {
      output += chalk.gray(`   ${pkg.issues.length} issue(s)\n`);
    }
  }

  // Recommendations
  if (report.recommendations && report.recommendations.length > 0) {
    output += chalk.bold('\n\nTop Recommendations:\n');
    for (const rec of report.recommendations.slice(0, 5)) {
      output += `  • ${rec.message}\n`;
    }
  }

  output += '\n';
  return output;
}

/**
 * Print a package report to console
 */
export function printPackageReport(result: PackageAuditResult): void {
  console.log(generatePackageReport(result));
}

/**
 * Print a full audit report to console
 */
export function printFullReport(report: AuditReport): void {
  console.log(generateFullReport(report));
}
