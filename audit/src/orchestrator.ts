/**
 * Audit orchestrator - coordinates all analysis phases
 * Provides high-level functions to run complete audits on packages
 */

import * as fs from 'fs';
import * as path from 'path';
import { runCoverageAnalysis } from './analyzers/coverage-analyzer';
import { analyzeDependencies } from './analyzers/cross-package-analyzer';
import {
  analyzePackage,
  calculateDocumentationCompleteness,
  findMissingExamples,
  findUndocumentedConfigOptions,
  findUndocumentedExports,
} from './analyzers/documentation-analyzer';
import { analyzeTestPatterns } from './analyzers/test-quality-analyzer';
import {
  AuditReport,
  AuditSummary,
  PackageAuditResult,
  Recommendation,
  ValidationError,
} from './types';
import { validateExamples } from './validators/example-validator';
import { validateCrossReferences } from './validators/reference-validator';

/**
 * Options for running an audit
 */
export interface AuditOptions {
  /** Whether to run coverage analysis (can be slow) */
  includeCoverage?: boolean;
  /** Whether to run cross-package analysis */
  includeCrossPackage?: boolean;
  /** Whether to validate examples */
  validateExamples?: boolean;
  /** Whether to validate cross-references */
  validateReferences?: boolean;
  /** Packages to exclude from audit */
  excludePackages?: string[];
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Default audit options
 */
const DEFAULT_OPTIONS: AuditOptions = {
  includeCoverage: true,
  includeCrossPackage: true,
  validateExamples: true,
  validateReferences: true,
  excludePackages: [],
  verbose: false,
};

/**
 * Run a complete audit on all packages in the monorepo
 * @param monorepoRoot - Root directory of the monorepo
 * @param options - Audit options
 * @returns Complete audit report
 */
export function runFullAudit(
  monorepoRoot: string,
  options: AuditOptions = {}
): AuditReport {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.verbose) {
    console.log('Starting full audit...');
    console.log(`Monorepo root: ${monorepoRoot}`);
  }

  // Find all packages
  const packagePaths = findAllPackages(monorepoRoot);
  const filteredPackages = packagePaths.filter(
    (pkg) => !opts.excludePackages?.some((excluded) => pkg.includes(excluded))
  );

  if (opts.verbose) {
    console.log(`Found ${filteredPackages.length} packages to audit`);
  }

  // Audit each package
  const packageResults: PackageAuditResult[] = [];

  for (const packagePath of filteredPackages) {
    const packageName = getPackageName(packagePath);

    if (opts.verbose) {
      console.log(`\nAuditing ${packageName}...`);
    }

    try {
      const result = runPackageAudit(packagePath, opts);
      packageResults.push(result);

      if (opts.verbose) {
        console.log(
          `  Documentation: ${
            result.documentation.exports.filter((e) => e.isDocumented).length
          }/${result.documentation.exports.length} exports documented`
        );
        console.log(`  Issues: ${result.issues.length}`);
      }
    } catch (error) {
      console.error(`Error auditing ${packageName}: ${error}`);
    }
  }

  // Generate summary
  const summary = generateSummary(packageResults);

  // Generate recommendations
  const recommendations = generateRecommendations(
    packageResults,
    monorepoRoot,
    opts
  );

  const report: AuditReport = {
    timestamp: new Date(),
    packages: packageResults,
    summary,
    recommendations,
  };

  if (opts.verbose) {
    console.log('\n=== Audit Complete ===');
    console.log(`Total packages: ${summary.totalPackages}`);
    console.log(`Packages with issues: ${summary.packagesWithIssues}`);
    console.log(`Critical issues: ${summary.criticalIssues}`);
    console.log(`Warnings: ${summary.warnings}`);
    console.log(
      `Overall documentation score: ${summary.overallDocumentationScore.toFixed(
        1
      )}%`
    );
    console.log(
      `Overall coverage score: ${summary.overallCoverageScore.toFixed(1)}%`
    );
  }

  return report;
}

/**
 * Run audit on a single package
 * @param packagePath - Path to the package directory
 * @param options - Audit options
 * @returns Package audit result
 */
export function runPackageAudit(
  packagePath: string,
  options: AuditOptions = {}
): PackageAuditResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const packageName = getPackageName(packagePath);

  // Analyze documentation
  const documentation = analyzePackage(packagePath);

  // Analyze coverage (if enabled)
  let coverage;
  if (opts.includeCoverage) {
    try {
      coverage = runCoverageAnalysis(packagePath);
    } catch (error) {
      if (opts.verbose) {
        console.warn(`  Warning: Could not analyze coverage: ${error}`);
      }
      // Create empty coverage report
      coverage = {
        packageName,
        statements: {
          total: 0,
          covered: 0,
          percentage: 0,
          meetsThreshold: false,
        },
        branches: {
          total: 0,
          covered: 0,
          percentage: 0,
          meetsThreshold: false,
        },
        functions: {
          total: 0,
          covered: 0,
          percentage: 0,
          meetsThreshold: false,
        },
        lines: { total: 0, covered: 0, percentage: 0, meetsThreshold: false },
        files: [],
        untestedExports: [],
      };
    }
  } else {
    // Create empty coverage report
    coverage = {
      packageName,
      statements: {
        total: 0,
        covered: 0,
        percentage: 0,
        meetsThreshold: false,
      },
      branches: { total: 0, covered: 0, percentage: 0, meetsThreshold: false },
      functions: { total: 0, covered: 0, percentage: 0, meetsThreshold: false },
      lines: { total: 0, covered: 0, percentage: 0, meetsThreshold: false },
      files: [],
      untestedExports: [],
    };
  }

  // Analyze test quality
  const quality = analyzeTestPatterns(packagePath);

  // Collect issues
  const issues: ValidationError[] = [];

  // Check for undocumented exports
  const undocumentedExports = findUndocumentedExports(documentation);
  for (const exp of undocumentedExports) {
    issues.push({
      type: 'UndocumentedExportError',
      severity: 'critical',
      message: `Export '${exp.name}' (${exp.type}) is not documented in README`,
      location: exp.sourceFile,
      recommendation: `Add documentation for '${exp.name}' to the package README file.`,
    });
  }

  // Check for missing examples
  const missingExamples = findMissingExamples(documentation);
  for (const exp of missingExamples) {
    issues.push({
      type: 'MissingExampleError',
      severity: 'warning',
      message: `Major feature '${exp.name}' (${exp.type}) lacks usage example`,
      location: exp.sourceFile,
      recommendation: `Add a usage example for '${exp.name}' to the package README file.`,
    });
  }

  // Check for undocumented config options
  const undocumentedConfig = findUndocumentedConfigOptions(documentation);
  for (const config of undocumentedConfig) {
    issues.push({
      type: 'UndocumentedConfigError',
      severity: 'warning',
      message: `Configuration option '${config.name}' is not documented`,
      recommendation: `Document the '${config.name}' configuration option in the README.`,
    });
  }

  // Validate examples (if enabled)
  if (opts.validateExamples) {
    const readmePath = findReadme(packagePath);
    if (readmePath) {
      const exampleErrors = validateExamples(readmePath, packagePath);
      issues.push(...exampleErrors);
    }
  }

  // Validate cross-references (if enabled)
  if (opts.validateReferences) {
    const readmePath = findReadme(packagePath);
    if (readmePath) {
      try {
        const monorepoRoot = findMonorepoRoot(packagePath);
        const crossReferences = validateCrossReferences(
          readmePath,
          packageName,
          monorepoRoot
        );

        // Convert invalid cross-references to validation errors
        for (const ref of crossReferences) {
          if (!ref.isValid) {
            issues.push({
              type: 'InvalidReferenceError',
              severity: 'warning',
              message: `Invalid cross-reference to ${ref.targetPackage}${
                ref.targetSymbol ? '.' + ref.targetSymbol : ''
              }`,
              location: ref.location,
              recommendation: `Verify that the referenced package and symbol exist, or update the reference.`,
            });
          }
        }
      } catch (error) {
        if (opts.verbose) {
          console.warn(
            `  Warning: Could not validate cross-references: ${error}`
          );
        }
      }
    }
  }

  // Check coverage thresholds
  if (opts.includeCoverage) {
    if (!coverage.statements.meetsThreshold) {
      issues.push({
        type: 'InsufficientCoverageError',
        severity: 'warning',
        message: `Statement coverage (${coverage.statements.percentage.toFixed(
          1
        )}%) is below threshold (90%)`,
        recommendation: 'Add more tests to increase statement coverage.',
      });
    }

    if (!coverage.branches.meetsThreshold) {
      issues.push({
        type: 'InsufficientCoverageError',
        severity: 'warning',
        message: `Branch coverage (${coverage.branches.percentage.toFixed(
          1
        )}%) is below threshold (85%)`,
        recommendation: 'Add tests for untested branches and edge cases.',
      });
    }

    // Check for untested exports
    for (const untested of coverage.untestedExports) {
      issues.push({
        type: 'UntestedExportError',
        severity: 'warning',
        message: `Export '${untested.symbol.name}' has no tests`,
        location: untested.symbol.sourceFile,
        recommendation: `Add tests for '${untested.symbol.name}'.`,
      });
    }
  }

  return {
    packageName,
    documentation,
    coverage,
    quality,
    issues,
  };
}

/**
 * Run incremental audit on changed packages only
 * @param monorepoRoot - Root directory of the monorepo
 * @param changedFiles - Array of changed file paths (relative to monorepo root)
 * @param options - Audit options
 * @returns Audit report for changed packages only
 */
export function runIncrementalAudit(
  monorepoRoot: string,
  changedFiles: string[],
  options: AuditOptions = {}
): AuditReport {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.verbose) {
    console.log('Starting incremental audit...');
    console.log(`Changed files: ${changedFiles.length}`);
  }

  // Determine which packages are affected by the changes
  const affectedPackages = findAffectedPackages(monorepoRoot, changedFiles);

  if (opts.verbose) {
    console.log(`Affected packages: ${affectedPackages.length}`);
    for (const pkg of affectedPackages) {
      console.log(`  - ${getPackageName(pkg)}`);
    }
  }

  // Filter out excluded packages
  const filteredPackages = affectedPackages.filter(
    (pkg) => !opts.excludePackages?.some((excluded) => pkg.includes(excluded))
  );

  // Audit affected packages
  const packageResults: PackageAuditResult[] = [];

  for (const packagePath of filteredPackages) {
    const packageName = getPackageName(packagePath);

    if (opts.verbose) {
      console.log(`\nAuditing ${packageName}...`);
    }

    try {
      const result = runPackageAudit(packagePath, opts);
      packageResults.push(result);
    } catch (error) {
      console.error(`Error auditing ${packageName}: ${error}`);
    }
  }

  // Generate summary
  const summary = generateSummary(packageResults);

  // Generate recommendations
  const recommendations = generateRecommendations(
    packageResults,
    monorepoRoot,
    opts
  );

  return {
    timestamp: new Date(),
    packages: packageResults,
    summary,
    recommendations,
  };
}

/**
 * Find all packages in the monorepo
 * @param monorepoRoot - Root directory of the monorepo
 * @returns Array of package directory paths
 */
function findAllPackages(monorepoRoot: string): string[] {
  const packages: string[] = [];

  // Check for packages directory
  const packagesDir = path.join(monorepoRoot, 'packages');
  if (fs.existsSync(packagesDir)) {
    const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const packagePath = path.join(packagesDir, entry.name);
        if (fs.existsSync(path.join(packagePath, 'package.json'))) {
          packages.push(packagePath);
        }
      }
    }
  }

  return packages;
}

/**
 * Find packages affected by changed files
 * @param monorepoRoot - Root directory of the monorepo
 * @param changedFiles - Array of changed file paths
 * @returns Array of affected package paths
 */
function findAffectedPackages(
  monorepoRoot: string,
  changedFiles: string[]
): string[] {
  const allPackages = findAllPackages(monorepoRoot);
  const affectedPackages = new Set<string>();

  for (const changedFile of changedFiles) {
    const absolutePath = path.isAbsolute(changedFile)
      ? changedFile
      : path.join(monorepoRoot, changedFile);

    // Find which package this file belongs to
    for (const packagePath of allPackages) {
      if (absolutePath.startsWith(packagePath)) {
        affectedPackages.add(packagePath);
        break;
      }
    }
  }

  return Array.from(affectedPackages);
}

/**
 * Get package name from package.json
 * @param packagePath - Path to the package directory
 * @returns Package name
 */
function getPackageName(packagePath: string): string {
  try {
    const packageJsonPath = path.join(packagePath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.name || path.basename(packagePath);
  } catch (_error) {
    return path.basename(packagePath);
  }
}

/**
 * Find README file in a package
 * @param packagePath - Path to the package directory
 * @returns Path to README file or null
 */
function findReadme(packagePath: string): string | null {
  const possibleNames = [
    'README.md',
    'readme.md',
    'Readme.md',
    'README',
    'readme',
  ];

  for (const name of possibleNames) {
    const readmePath = path.join(packagePath, name);
    if (fs.existsSync(readmePath)) {
      return readmePath;
    }
  }

  return null;
}

/**
 * Find monorepo root from a package path
 * @param packagePath - Path to a package
 * @returns Path to monorepo root
 */
function findMonorepoRoot(packagePath: string): string {
  let currentPath = packagePath;

  // Walk up the directory tree until we find a directory with a packages folder
  while (currentPath !== path.dirname(currentPath)) {
    const packagesDir = path.join(currentPath, 'packages');
    if (fs.existsSync(packagesDir)) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }

  // If we can't find it, assume the parent of the package is the root
  return path.dirname(packagePath);
}

/**
 * Generate summary from package results
 * @param packageResults - Array of package audit results
 * @returns Audit summary
 */
function generateSummary(packageResults: PackageAuditResult[]): AuditSummary {
  const totalPackages = packageResults.length;
  const packagesWithIssues = packageResults.filter(
    (r) => r.issues.length > 0
  ).length;

  // Calculate overall documentation score
  let totalDocScore = 0;
  for (const result of packageResults) {
    const docCompleteness = calculateDocumentationCompleteness(
      result.documentation
    );
    totalDocScore += docCompleteness;
  }
  const overallDocumentationScore =
    totalPackages > 0 ? totalDocScore / totalPackages : 100;

  // Calculate overall coverage score
  let totalCovScore = 0;
  for (const result of packageResults) {
    totalCovScore += result.coverage.statements.percentage;
  }
  const overallCoverageScore =
    totalPackages > 0 ? totalCovScore / totalPackages : 0;

  // Count critical issues and warnings
  let criticalIssues = 0;
  let warnings = 0;

  for (const result of packageResults) {
    for (const issue of result.issues) {
      if (issue.severity === 'critical') {
        criticalIssues++;
      } else if (issue.severity === 'warning') {
        warnings++;
      }
    }
  }

  return {
    totalPackages,
    packagesWithIssues,
    overallDocumentationScore,
    overallCoverageScore,
    criticalIssues,
    warnings,
  };
}

/**
 * Generate recommendations based on audit results
 * @param packageResults - Array of package audit results
 * @param monorepoRoot - Root directory of the monorepo
 * @param options - Audit options
 * @returns Array of recommendations
 */
function generateRecommendations(
  packageResults: PackageAuditResult[],
  monorepoRoot: string,
  options: AuditOptions
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Find packages with the most undocumented exports
  const packagesWithUndocumentedExports = packageResults
    .map((r) => ({
      name: r.packageName,
      count: r.issues.filter((i) => i.type === 'UndocumentedExportError')
        .length,
    }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count);

  if (packagesWithUndocumentedExports.length > 0) {
    const topPackages = packagesWithUndocumentedExports.slice(0, 3);
    recommendations.push({
      priority: 'high',
      category: 'Documentation',
      message: `${packagesWithUndocumentedExports.length} package(s) have undocumented exports`,
      affectedPackages: topPackages.map((p) => p.name),
      actionItems: [
        'Review and document all exported functions, classes, and interfaces',
        'Add usage examples for major features',
        'Update README files with API documentation',
      ],
    });
  }

  // Find packages with low test coverage
  const packagesWithLowCoverage = packageResults
    .map((r) => ({
      name: r.packageName,
      coverage: r.coverage.statements.percentage,
    }))
    .filter((p) => p.coverage < 90)
    .sort((a, b) => a.coverage - b.coverage);

  if (packagesWithLowCoverage.length > 0 && options.includeCoverage) {
    const topPackages = packagesWithLowCoverage.slice(0, 3);
    recommendations.push({
      priority: 'high',
      category: 'Testing',
      message: `${packagesWithLowCoverage.length} package(s) have test coverage below 90%`,
      affectedPackages: topPackages.map((p) => p.name),
      actionItems: [
        'Add tests for untested exports',
        'Add tests for error conditions and edge cases',
        'Increase branch coverage by testing all code paths',
      ],
    });
  }

  // Find packages with missing examples
  const packagesWithMissingExamples = packageResults
    .map((r) => ({
      name: r.packageName,
      count: r.issues.filter((i) => i.type === 'MissingExampleError').length,
    }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count);

  if (packagesWithMissingExamples.length > 0) {
    const topPackages = packagesWithMissingExamples.slice(0, 3);
    recommendations.push({
      priority: 'medium',
      category: 'Documentation',
      message: `${packagesWithMissingExamples.length} package(s) have major features without usage examples`,
      affectedPackages: topPackages.map((p) => p.name),
      actionItems: [
        'Add code examples for all major features (classes and primary functions)',
        'Ensure examples are tested and work correctly',
        'Include examples in README files',
      ],
    });
  }

  // Check for cross-package integration issues
  if (options.includeCrossPackage) {
    try {
      const dependencyGraph = analyzeDependencies(monorepoRoot);
      const integrationPoints = dependencyGraph.integrationPoints;

      const undocumentedIntegrations = integrationPoints.filter(
        (ip) => !ip.isDocumented
      );
      const untestedIntegrations = integrationPoints.filter(
        (ip) => !ip.hasTests
      );

      if (undocumentedIntegrations.length > 0) {
        recommendations.push({
          priority: 'medium',
          category: 'Integration',
          message: `${undocumentedIntegrations.length} cross-package integration(s) are not documented`,
          affectedPackages: Array.from(
            new Set(undocumentedIntegrations.map((ip) => ip.sourcePackage))
          ),
          actionItems: [
            'Document how packages integrate with each other',
            'Add examples of cross-package usage',
            'Update README files with integration documentation',
          ],
        });
      }

      if (untestedIntegrations.length > 0) {
        recommendations.push({
          priority: 'medium',
          category: 'Integration',
          message: `${untestedIntegrations.length} cross-package integration(s) lack tests`,
          affectedPackages: Array.from(
            new Set(untestedIntegrations.map((ip) => ip.sourcePackage))
          ),
          actionItems: [
            'Add integration tests for cross-package functionality',
            'Test that documented integration patterns work correctly',
            'Verify binary compatibility between related packages',
          ],
        });
      }
    } catch (_error) {
      // Ignore cross-package analysis errors
    }
  }

  return recommendations;
}
