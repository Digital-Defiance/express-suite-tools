#!/usr/bin/env node
/**
 * CLI interface for the audit tool
 * Provides commands for running audits, validating packages, and generating reports
 */

import chalk from 'chalk';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import {
  AuditOptions,
  runFullAudit,
  runIncrementalAudit,
  runPackageAudit,
} from './orchestrator';
import {
  printFullReport,
  printPackageReport,
} from './reporters/console-reporter';
import {
  savePackageReport as saveHtmlPackageReport,
  saveFullReport as saveHtmlReport,
} from './reporters/html-reporter';
import {
  savePackageReport as saveJsonPackageReport,
  saveFullReport as saveJsonReport,
} from './reporters/json-reporter';
import { AuditReport, PackageAuditResult } from './types';

const program = new Command();

/**
 * Configuration options that can be set via CLI flags
 */
interface CliConfig {
  coverage: boolean;
  crossPackage: boolean;
  examples: boolean;
  references: boolean;
  verbose: boolean;
  output?: string;
  format: 'console' | 'json' | 'html';
  exclude: string[];
  statementThreshold: number;
  branchThreshold: number;
}

/**
 * Default CLI configuration
 */
const defaultConfig: CliConfig = {
  coverage: true,
  crossPackage: true,
  examples: true,
  references: true,
  verbose: false,
  format: 'console',
  exclude: [],
  statementThreshold: 90,
  branchThreshold: 85,
};

/**
 * Find the monorepo root from the current directory
 */
function findMonorepoRoot(): string {
  let currentPath = process.cwd();

  // Walk up the directory tree until we find a directory with a packages folder
  while (currentPath !== path.dirname(currentPath)) {
    const packagesDir = path.join(currentPath, 'packages');
    if (fs.existsSync(packagesDir)) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }

  // If we can't find it, use the current directory
  return process.cwd();
}

/**
 * Convert CLI config to audit options
 */
function configToOptions(config: CliConfig): AuditOptions {
  return {
    includeCoverage: config.coverage,
    includeCrossPackage: config.crossPackage,
    validateExamples: config.examples,
    validateReferences: config.references,
    verbose: config.verbose,
    excludePackages: config.exclude,
  };
}

/**
 * Save report in the specified format
 */
function saveReport(
  report: AuditReport | PackageAuditResult,
  config: CliConfig
): void {
  if (!config.output) {
    return;
  }

  const outputPath = path.resolve(config.output);
  const isFullReport = 'packages' in report;

  try {
    if (config.format === 'json') {
      if (isFullReport) {
        saveJsonReport(report as AuditReport, outputPath);
      } else {
        saveJsonPackageReport(report as PackageAuditResult, outputPath);
      }
      console.log(chalk.green(`✅ JSON report saved to ${outputPath}`));
    } else if (config.format === 'html') {
      if (isFullReport) {
        saveHtmlReport(report as AuditReport, outputPath);
      } else {
        saveHtmlPackageReport(report as PackageAuditResult, outputPath);
      }
      console.log(chalk.green(`✅ HTML report saved to ${outputPath}`));
    }
  } catch (error) {
    console.error(chalk.red(`❌ Failed to save report: ${error}`));
    process.exit(1);
  }
}

// Configure the CLI program
program
  .name('audit-suite')
  .description('Documentation and test coverage audit tool for Express Suite')
  .version('1.0.0');

// Global options
program
  .option('--no-coverage', 'Skip coverage analysis')
  .option('--no-cross-package', 'Skip cross-package analysis')
  .option('--no-examples', 'Skip example validation')
  .option('--no-references', 'Skip cross-reference validation')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-o, --output <path>', 'Output file path for report')
  .option(
    '-f, --format <format>',
    'Output format (console, json, html)',
    'console'
  )
  .option('-e, --exclude <packages...>', 'Packages to exclude from audit', [])
  .option(
    '--statement-threshold <number>',
    'Statement coverage threshold percentage',
    '90'
  )
  .option(
    '--branch-threshold <number>',
    'Branch coverage threshold percentage',
    '85'
  );

/**
 * Command: audit
 * Run a full audit on all packages in the monorepo
 */
program
  .command('audit')
  .description('Run a full audit on all packages in the monorepo')
  .option('-r, --root <path>', 'Monorepo root directory')
  .action((options) => {
    const config: CliConfig = {
      ...defaultConfig,
      coverage: program.opts().coverage !== false,
      crossPackage: program.opts().crossPackage !== false,
      examples: program.opts().examples !== false,
      references: program.opts().references !== false,
      verbose: program.opts().verbose || false,
      output: program.opts().output,
      format: program.opts().format || 'console',
      exclude: program.opts().exclude || [],
      statementThreshold: parseInt(program.opts().statementThreshold) || 90,
      branchThreshold: parseInt(program.opts().branchThreshold) || 85,
    };

    const monorepoRoot = options.root
      ? path.resolve(options.root)
      : findMonorepoRoot();

    console.log(chalk.bold.cyan('\n🔍 Starting full audit...\n'));
    console.log(chalk.gray(`Monorepo root: ${monorepoRoot}`));

    try {
      const auditOptions = configToOptions(config);
      const report = runFullAudit(monorepoRoot, auditOptions);

      // Print to console if format is console or if no output file specified
      if (config.format === 'console' || !config.output) {
        printFullReport(report);
      }

      // Save to file if output path specified
      if (config.output) {
        saveReport(report, config);
      }

      // Exit with error code if there are critical issues
      if (report.summary.criticalIssues > 0) {
        console.log(
          chalk.red(
            `\n❌ Audit failed with ${report.summary.criticalIssues} critical issue(s)`
          )
        );
        process.exit(1);
      } else {
        console.log(chalk.green('\n✅ Audit completed successfully'));
        process.exit(0);
      }
    } catch (error) {
      console.error(chalk.red(`\n❌ Audit failed: ${error}`));
      if (config.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

/**
 * Command: audit:package
 * Run audit on a single package
 */
program
  .command('audit:package <package>')
  .description('Run audit on a single package')
  .option('-r, --root <path>', 'Monorepo root directory')
  .action((packageName, options) => {
    const config: CliConfig = {
      ...defaultConfig,
      coverage: program.opts().coverage !== false,
      crossPackage: program.opts().crossPackage !== false,
      examples: program.opts().examples !== false,
      references: program.opts().references !== false,
      verbose: program.opts().verbose || false,
      output: program.opts().output,
      format: program.opts().format || 'console',
      exclude: program.opts().exclude || [],
      statementThreshold: parseInt(program.opts().statementThreshold) || 90,
      branchThreshold: parseInt(program.opts().branchThreshold) || 85,
    };

    const monorepoRoot = options.root
      ? path.resolve(options.root)
      : findMonorepoRoot();

    console.log(chalk.bold.cyan(`\n🔍 Auditing package: ${packageName}\n`));

    // Find the package path
    let packagePath: string;
    if (path.isAbsolute(packageName)) {
      packagePath = packageName;
    } else if (fs.existsSync(packageName)) {
      packagePath = path.resolve(packageName);
    } else {
      // Try to find in packages directory
      packagePath = path.join(monorepoRoot, 'packages', packageName);
      if (!fs.existsSync(packagePath)) {
        console.error(chalk.red(`❌ Package not found: ${packageName}`));
        process.exit(1);
      }
    }

    // Verify package.json exists
    if (!fs.existsSync(path.join(packagePath, 'package.json'))) {
      console.error(chalk.red(`❌ No package.json found in ${packagePath}`));
      process.exit(1);
    }

    try {
      const auditOptions = configToOptions(config);
      const result = runPackageAudit(packagePath, auditOptions);

      // Print to console if format is console or if no output file specified
      if (config.format === 'console' || !config.output) {
        printPackageReport(result);
      }

      // Save to file if output path specified
      if (config.output) {
        saveReport(result, config);
      }

      // Exit with error code if there are critical issues
      const criticalIssues = result.issues.filter(
        (i) => i.severity === 'critical'
      ).length;
      if (criticalIssues > 0) {
        console.log(
          chalk.red(
            `\n❌ Audit failed with ${criticalIssues} critical issue(s)`
          )
        );
        process.exit(1);
      } else {
        console.log(chalk.green('\n✅ Audit completed successfully'));
        process.exit(0);
      }
    } catch (error) {
      console.error(chalk.red(`\n❌ Audit failed: ${error}`));
      if (config.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

/**
 * Command: validate
 * Run validation checks for CI/CD (fails on critical issues)
 */
program
  .command('validate')
  .description('Run validation checks for CI/CD (fails on critical issues)')
  .option('-r, --root <path>', 'Monorepo root directory')
  .option('--changed <files...>', 'Only validate changed files')
  .action((options) => {
    const config: CliConfig = {
      ...defaultConfig,
      coverage: program.opts().coverage !== false,
      crossPackage: program.opts().crossPackage !== false,
      examples: program.opts().examples !== false,
      references: program.opts().references !== false,
      verbose: program.opts().verbose || false,
      output: program.opts().output,
      format: program.opts().format || 'json',
      exclude: program.opts().exclude || [],
      statementThreshold: parseInt(program.opts().statementThreshold) || 90,
      branchThreshold: parseInt(program.opts().branchThreshold) || 85,
    };

    const monorepoRoot = options.root
      ? path.resolve(options.root)
      : findMonorepoRoot();

    console.log(chalk.bold.cyan('\n🔍 Running validation...\n'));

    try {
      const auditOptions = configToOptions(config);
      let report: AuditReport;

      if (options.changed && options.changed.length > 0) {
        console.log(
          chalk.gray(`Validating ${options.changed.length} changed file(s)`)
        );
        report = runIncrementalAudit(
          monorepoRoot,
          options.changed,
          auditOptions
        );
      } else {
        report = runFullAudit(monorepoRoot, auditOptions);
      }

      // Always output validation results in a CI-friendly format
      console.log(chalk.bold('\nValidation Results:'));
      console.log(`  Total Packages: ${report.summary.totalPackages}`);
      console.log(
        `  Documentation Score: ${report.summary.overallDocumentationScore.toFixed(
          1
        )}%`
      );
      console.log(
        `  Coverage Score: ${report.summary.overallCoverageScore.toFixed(1)}%`
      );
      console.log(
        `  Critical Issues: ${chalk.red(report.summary.criticalIssues)}`
      );
      console.log(`  Warnings: ${chalk.yellow(report.summary.warnings)}`);

      // List critical issues
      if (report.summary.criticalIssues > 0) {
        console.log(chalk.bold.red('\n❌ Critical Issues:'));
        for (const pkg of report.packages) {
          const criticalIssues = pkg.issues.filter(
            (i) => i.severity === 'critical'
          );
          if (criticalIssues.length > 0) {
            console.log(chalk.red(`\n  ${pkg.packageName}:`));
            for (const issue of criticalIssues) {
              console.log(chalk.red(`    • ${issue.message}`));
            }
          }
        }
      }

      // Save report if output path specified
      if (config.output) {
        saveReport(report, config);
      }

      // Exit with appropriate code
      if (report.summary.criticalIssues > 0) {
        console.log(
          chalk.red(
            `\n❌ Validation failed with ${report.summary.criticalIssues} critical issue(s)`
          )
        );
        process.exit(1);
      } else {
        console.log(chalk.green('\n✅ Validation passed'));
        process.exit(0);
      }
    } catch (error) {
      console.error(chalk.red(`\n❌ Validation failed: ${error}`));
      if (config.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

/**
 * Command: report
 * Generate reports from existing audit data or run new audit
 */
program
  .command('report')
  .description('Generate reports from audit data')
  .option('-r, --root <path>', 'Monorepo root directory')
  .option('-i, --input <path>', 'Input JSON report file')
  .requiredOption('-o, --output <path>', 'Output file path')
  .requiredOption('-f, --format <format>', 'Output format (json, html)', 'html')
  .action((options) => {
    const config: CliConfig = {
      ...defaultConfig,
      coverage: program.opts().coverage !== false,
      crossPackage: program.opts().crossPackage !== false,
      examples: program.opts().examples !== false,
      references: program.opts().references !== false,
      verbose: program.opts().verbose || false,
      output: options.output,
      format: options.format || 'html',
      exclude: program.opts().exclude || [],
      statementThreshold: parseInt(program.opts().statementThreshold) || 90,
      branchThreshold: parseInt(program.opts().branchThreshold) || 85,
    };

    console.log(chalk.bold.cyan('\n📊 Generating report...\n'));

    try {
      let report: AuditReport;

      if (options.input) {
        // Load existing report
        console.log(chalk.gray(`Loading report from ${options.input}`));
        const content = fs.readFileSync(options.input, 'utf-8');
        report = JSON.parse(content) as AuditReport;
      } else {
        // Run new audit
        const monorepoRoot = options.root
          ? path.resolve(options.root)
          : findMonorepoRoot();
        console.log(chalk.gray(`Running audit on ${monorepoRoot}`));
        const auditOptions = configToOptions(config);
        report = runFullAudit(monorepoRoot, auditOptions);
      }

      // Save report
      saveReport(report, config);

      console.log(chalk.green('\n✅ Report generated successfully'));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red(`\n❌ Report generation failed: ${error}`));
      if (config.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command specified
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
