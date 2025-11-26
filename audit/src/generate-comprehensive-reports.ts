#!/usr/bin/env node
/**
 * Generate comprehensive audit reports for all packages
 * This script runs the full audit and generates all report formats
 */

import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { runFullAudit } from './orchestrator';
import { printFullReport } from './reporters/console-reporter';
import {
  savePackageReport as saveHtmlPackageReport,
  saveFullReport as saveHtmlReport,
} from './reporters/html-reporter';
import {
  savePackageReport as saveJsonPackageReport,
  saveFullReport as saveJsonReport,
} from './reporters/json-reporter';
import { AuditReport } from './types';

/**
 * Priority gap - represents a high-priority issue that needs attention
 */
interface PriorityGap {
  priority: 'critical' | 'high' | 'medium';
  category: 'documentation' | 'coverage' | 'integration';
  packageName: string;
  description: string;
  count: number;
  recommendation: string;
}

/**
 * Find monorepo root
 */
function findMonorepoRoot(): string {
  let currentPath = process.cwd();

  while (currentPath !== path.dirname(currentPath)) {
    const packagesDir = path.join(currentPath, 'packages');
    if (fs.existsSync(packagesDir)) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }

  return process.cwd();
}

/**
 * Identify top priority documentation gaps
 */
function identifyDocumentationGaps(report: AuditReport): PriorityGap[] {
  const gaps: PriorityGap[] = [];

  for (const pkg of report.packages) {
    // Count undocumented exports
    const undocumentedExports = pkg.issues.filter(
      (i) => i.type === 'UndocumentedExportError'
    );

    if (undocumentedExports.length > 0) {
      gaps.push({
        priority: undocumentedExports.length > 10 ? 'critical' : 'high',
        category: 'documentation',
        packageName: pkg.packageName,
        description: `${undocumentedExports.length} undocumented exports`,
        count: undocumentedExports.length,
        recommendation: `Document all exported functions, classes, and interfaces in the README`,
      });
    }

    // Count missing examples
    const missingExamples = pkg.issues.filter(
      (i) => i.type === 'MissingExampleError'
    );

    if (missingExamples.length > 5) {
      gaps.push({
        priority: 'high',
        category: 'documentation',
        packageName: pkg.packageName,
        description: `${missingExamples.length} major features without examples`,
        count: missingExamples.length,
        recommendation: `Add usage examples for major features in the README`,
      });
    }

    // Check for missing configuration documentation
    const undocumentedConfig = pkg.issues.filter(
      (i) => i.type === 'UndocumentedConfigError'
    );

    if (undocumentedConfig.length > 0) {
      gaps.push({
        priority: 'medium',
        category: 'documentation',
        packageName: pkg.packageName,
        description: `${undocumentedConfig.length} undocumented configuration options`,
        count: undocumentedConfig.length,
        recommendation: `Document all configuration options with their defaults`,
      });
    }
  }

  // Sort by priority and count
  gaps.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.count - a.count;
  });

  return gaps;
}

/**
 * Identify top priority test coverage gaps
 */
function identifyCoverageGaps(report: AuditReport): PriorityGap[] {
  const gaps: PriorityGap[] = [];

  for (const pkg of report.packages) {
    // Check statement coverage
    if (
      pkg.coverage &&
      pkg.coverage.statements &&
      pkg.coverage.statements.percentage < 90
    ) {
      const deficit = 90 - pkg.coverage.statements.percentage;
      gaps.push({
        priority: deficit > 20 ? 'critical' : deficit > 10 ? 'high' : 'medium',
        category: 'coverage',
        packageName: pkg.packageName,
        description: `Statement coverage at ${pkg.coverage.statements.percentage.toFixed(
          1
        )}% (target: 90%)`,
        count: Math.round(deficit),
        recommendation: `Add tests to increase statement coverage by ${deficit.toFixed(
          1
        )}%`,
      });
    }

    // Check branch coverage
    if (
      pkg.coverage &&
      pkg.coverage.branches &&
      pkg.coverage.branches.percentage < 85
    ) {
      const deficit = 85 - pkg.coverage.branches.percentage;
      if (deficit > 10) {
        gaps.push({
          priority: deficit > 20 ? 'high' : 'medium',
          category: 'coverage',
          packageName: pkg.packageName,
          description: `Branch coverage at ${pkg.coverage.branches.percentage.toFixed(
            1
          )}% (target: 85%)`,
          count: Math.round(deficit),
          recommendation: `Add tests for untested branches and edge cases`,
        });
      }
    }

    // Count untested exports
    const untestedExports = pkg.issues.filter(
      (i) => i.type === 'UntestedExportError'
    );

    if (untestedExports.length > 5) {
      gaps.push({
        priority: untestedExports.length > 15 ? 'high' : 'medium',
        category: 'coverage',
        packageName: pkg.packageName,
        description: `${untestedExports.length} untested exports`,
        count: untestedExports.length,
        recommendation: `Add tests for all exported functions and classes`,
      });
    }

    // Check for missing error tests
    const missingErrorTests = pkg.issues.filter(
      (i) => i.type === 'MissingErrorTestError'
    );

    if (missingErrorTests.length > 0) {
      gaps.push({
        priority: 'medium',
        category: 'coverage',
        packageName: pkg.packageName,
        description: `${missingErrorTests.length} functions without error tests`,
        count: missingErrorTests.length,
        recommendation: `Add tests for error conditions and edge cases`,
      });
    }
  }

  // Sort by priority and count
  gaps.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.count - a.count;
  });

  return gaps;
}

/**
 * Generate summary markdown for root README
 */
function generateSummaryMarkdown(
  report: AuditReport,
  docGaps: PriorityGap[],
  coverageGaps: PriorityGap[]
): string {
  let md = '# Express Suite Audit Summary\n\n';
  md += `*Generated: ${new Date(report.timestamp).toLocaleString()}*\n\n`;

  // Overall metrics
  md += '## Overall Metrics\n\n';
  md += `- **Total Packages**: ${report.summary.totalPackages}\n`;
  md += `- **Documentation Score**: ${report.summary.overallDocumentationScore.toFixed(
    1
  )}%\n`;
  md += `- **Test Coverage Score**: ${report.summary.overallCoverageScore.toFixed(
    1
  )}%\n`;
  md += `- **Critical Issues**: ${report.summary.criticalIssues}\n`;
  md += `- **Warnings**: ${report.summary.warnings}\n\n`;

  // Package status
  md += '## Package Status\n\n';
  md += '| Package | Documentation | Coverage | Issues |\n';
  md += '|---------|--------------|----------|--------|\n';

  for (const pkg of report.packages) {
    const docScore = pkg.documentation
      ? (
          (pkg.documentation.exports.filter((e) => e.isDocumented).length /
            pkg.documentation.exports.length) *
          100
        ).toFixed(1)
      : 'N/A';

    const covScore = pkg.coverage?.statements?.percentage.toFixed(1) || 'N/A';

    const issueCount = pkg.issues?.length || 0;
    const criticalCount =
      pkg.issues?.filter((i) => i.severity === 'critical').length || 0;

    const issueText =
      criticalCount > 0
        ? `🔴 ${issueCount} (${criticalCount} critical)`
        : issueCount > 0
        ? `⚠️ ${issueCount}`
        : '✅ 0';

    md += `| ${pkg.packageName} | ${docScore}% | ${covScore}% | ${issueText} |\n`;
  }

  md += '\n';

  // Top documentation gaps
  if (docGaps.length > 0) {
    md += '## Top Documentation Gaps\n\n';
    const topDocGaps = docGaps.slice(0, 10);
    for (let i = 0; i < topDocGaps.length; i++) {
      const gap = topDocGaps[i];
      const icon =
        gap.priority === 'critical'
          ? '🔴'
          : gap.priority === 'high'
          ? '🟠'
          : '🟡';
      md += `${i + 1}. ${icon} **${gap.packageName}**: ${gap.description}\n`;
      md += `   - ${gap.recommendation}\n\n`;
    }
  }

  // Top coverage gaps
  if (coverageGaps.length > 0) {
    md += '## Top Test Coverage Gaps\n\n';
    const topCovGaps = coverageGaps.slice(0, 10);
    for (let i = 0; i < topCovGaps.length; i++) {
      const gap = topCovGaps[i];
      const icon =
        gap.priority === 'critical'
          ? '🔴'
          : gap.priority === 'high'
          ? '🟠'
          : '🟡';
      md += `${i + 1}. ${icon} **${gap.packageName}**: ${gap.description}\n`;
      md += `   - ${gap.recommendation}\n\n`;
    }
  }

  // Recommendations
  if (report.recommendations && report.recommendations.length > 0) {
    md += '## Recommendations\n\n';
    for (const rec of report.recommendations) {
      md += `### ${rec.category}\n\n`;
      md += `**Priority**: ${rec.priority}\n\n`;
      md += `${rec.message}\n\n`;
      if (rec.affectedPackages && rec.affectedPackages.length > 0) {
        md += `**Affected Packages**: ${rec.affectedPackages.join(', ')}\n\n`;
      }
      if (rec.actionItems && rec.actionItems.length > 0) {
        md += '**Action Items**:\n\n';
        for (const item of rec.actionItems) {
          md += `- ${item}\n`;
        }
        md += '\n';
      }
    }
  }

  // Links to detailed reports
  md += '## Detailed Reports\n\n';
  md += '- [Full HTML Report](./audit-results/index.html)\n';
  md += '- [Full JSON Report](./audit-results/full-report.json)\n\n';

  md += '### Individual Package Reports\n\n';
  for (const pkg of report.packages) {
    const safeName = pkg.packageName.replace(/[@/]/g, '-');
    md += `- [${pkg.packageName}](./audit-results/${safeName}.html)\n`;
  }

  return md;
}

/**
 * Main function to generate all reports
 */
async function main() {
  console.log(chalk.bold.cyan('\n📊 Generating Comprehensive Audit Reports\n'));
  console.log(chalk.bold.cyan('='.repeat(60) + '\n'));

  // Find monorepo root
  const monorepoRoot = findMonorepoRoot();
  console.log(chalk.gray(`Monorepo root: ${monorepoRoot}\n`));

  // Create output directory
  const outputDir = path.join(monorepoRoot, 'audit-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(chalk.bold('Step 1: Running full audit...\n'));
  console.log(
    chalk.yellow('Note: This will take several minutes. Please be patient...\n')
  );

  // Run full comprehensive audit with all validations
  const report = runFullAudit(monorepoRoot, {
    includeCoverage: true,
    includeCrossPackage: true,
    validateExamples: true,
    validateReferences: true,
    verbose: true,
  });

  console.log(chalk.green('✅ Audit complete\n'));

  // Print summary to console
  printFullReport(report);

  console.log(chalk.bold('\nStep 2: Generating HTML reports...\n'));

  // Generate full HTML report
  const fullHtmlPath = path.join(outputDir, 'index.html');
  saveHtmlReport(report, fullHtmlPath);
  console.log(chalk.green(`✅ Full HTML report: ${fullHtmlPath}`));

  // Generate individual package HTML reports
  for (const pkg of report.packages) {
    const safeName = pkg.packageName.replace(/[@/]/g, '-');
    const pkgHtmlPath = path.join(outputDir, `${safeName}.html`);
    saveHtmlPackageReport(pkg, pkgHtmlPath);
    console.log(chalk.gray(`   - ${pkg.packageName}: ${pkgHtmlPath}`));
  }

  console.log(chalk.bold('\nStep 3: Generating JSON reports...\n'));

  // Generate full JSON report
  const fullJsonPath = path.join(outputDir, 'full-report.json');
  saveJsonReport(report, fullJsonPath);
  console.log(chalk.green(`✅ Full JSON report: ${fullJsonPath}`));

  // Generate individual package JSON reports
  for (const pkg of report.packages) {
    const safeName = pkg.packageName.replace(/[@/]/g, '-');
    const pkgJsonPath = path.join(outputDir, `${safeName}.json`);
    saveJsonPackageReport(pkg, pkgJsonPath);
    console.log(chalk.gray(`   - ${pkg.packageName}: ${pkgJsonPath}`));
  }

  console.log(chalk.bold('\nStep 4: Identifying priority gaps...\n'));

  // Identify priority gaps
  const docGaps = identifyDocumentationGaps(report);
  const coverageGaps = identifyCoverageGaps(report);

  console.log(chalk.bold('Top Documentation Gaps:'));
  for (const gap of docGaps.slice(0, 5)) {
    const icon =
      gap.priority === 'critical'
        ? '🔴'
        : gap.priority === 'high'
        ? '🟠'
        : '🟡';
    console.log(`  ${icon} ${gap.packageName}: ${gap.description}`);
  }

  console.log(chalk.bold('\nTop Test Coverage Gaps:'));
  for (const gap of coverageGaps.slice(0, 5)) {
    const icon =
      gap.priority === 'critical'
        ? '🔴'
        : gap.priority === 'high'
        ? '🟠'
        : '🟡';
    console.log(`  ${icon} ${gap.packageName}: ${gap.description}`);
  }

  console.log(chalk.bold('\nStep 5: Generating summary report...\n'));

  // Generate summary markdown
  const summaryMd = generateSummaryMarkdown(report, docGaps, coverageGaps);
  const summaryPath = path.join(outputDir, 'AUDIT_SUMMARY.md');
  fs.writeFileSync(summaryPath, summaryMd, 'utf-8');
  console.log(chalk.green(`✅ Summary report: ${summaryPath}`));

  // Generate priority gaps JSON
  const gapsData = {
    timestamp: new Date(),
    documentation: docGaps,
    coverage: coverageGaps,
  };
  const gapsPath = path.join(outputDir, 'priority-gaps.json');
  fs.writeFileSync(gapsPath, JSON.stringify(gapsData, null, 2), 'utf-8');
  console.log(chalk.green(`✅ Priority gaps: ${gapsPath}`));

  console.log(chalk.bold.cyan('\n' + '='.repeat(60)));
  console.log(chalk.bold.green('\n✅ All reports generated successfully!\n'));

  // Final summary
  console.log(chalk.bold('Summary:'));
  console.log(`  - Total Packages: ${report.summary.totalPackages}`);
  console.log(
    `  - Documentation Score: ${report.summary.overallDocumentationScore.toFixed(
      1
    )}%`
  );
  console.log(
    `  - Coverage Score: ${report.summary.overallCoverageScore.toFixed(1)}%`
  );
  console.log(`  - Critical Issues: ${report.summary.criticalIssues}`);
  console.log(`  - Warnings: ${report.summary.warnings}`);
  console.log(`  - Documentation Gaps: ${docGaps.length}`);
  console.log(`  - Coverage Gaps: ${coverageGaps.length}`);

  console.log(chalk.bold('\nOutput Directory:'));
  console.log(`  ${outputDir}\n`);

  // Exit with appropriate code
  if (report.summary.criticalIssues > 0) {
    console.log(
      chalk.yellow(
        `⚠️  Note: ${report.summary.criticalIssues} critical issue(s) found\n`
      )
    );
    process.exit(0); // Don't fail, just report
  }
}

// Run the main function
main().catch((error) => {
  console.error(chalk.red('\n❌ Error generating reports:'));
  console.error(error);
  process.exit(1);
});
