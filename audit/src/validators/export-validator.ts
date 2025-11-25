/**
 * Export validator for automated export verification
 * Validates that all exported symbols are documented in README files
 */

import * as fs from 'fs';
import * as path from 'path';
import { analyzePackage } from '../analyzers/documentation-analyzer';
import { ExportedSymbol, ValidationError, ValidationResult } from '../types';

/**
 * Validate that all exports in a package are documented
 * @param packagePath - Path to the package directory
 * @returns Validation result with errors for undocumented exports
 */
export function validateExportsDocumented(
  packagePath: string
): ValidationResult {
  const errors: ValidationError[] = [];
  const packageDoc = analyzePackage(packagePath);

  // Find undocumented exports
  const undocumentedExports = packageDoc.exports.filter(
    (exp) => !exp.isDocumented
  );

  // Create errors for each undocumented export
  for (const exp of undocumentedExports) {
    errors.push({
      type: 'UndocumentedExportError',
      severity: 'critical',
      message: `Export '${exp.name}' (${exp.type}) is not documented in README`,
      location: exp.sourceFile,
      recommendation: `Add documentation for '${exp.name}' to the package README file. Include a description of what it does and provide a usage example.`,
    });
  }

  // Calculate documentation completeness
  const totalExports = packageDoc.exports.length;
  const documentedExports = packageDoc.exports.filter(
    (exp) => exp.isDocumented
  ).length;
  const documentationCompleteness =
    totalExports > 0 ? (documentedExports / totalExports) * 100 : 100;

  return {
    passed: errors.length === 0,
    errors,
    warnings: [],
    metrics: {
      documentationCompleteness,
      testCoverage: 0, // Not calculated here
      exampleCoverage: 0, // Not calculated here
      crossReferenceValidity: 0, // Not calculated here
    },
  };
}

/**
 * Validate exports for multiple packages
 * @param packagePaths - Array of package directory paths
 * @returns Aggregated validation result
 */
export function validateMultiplePackages(
  packagePaths: string[]
): ValidationResult {
  const allErrors: ValidationError[] = [];
  let totalDocumentationCompleteness = 0;

  for (const packagePath of packagePaths) {
    const result = validateExportsDocumented(packagePath);
    allErrors.push(...result.errors);
    totalDocumentationCompleteness += result.metrics.documentationCompleteness;
  }

  const avgDocumentationCompleteness =
    packagePaths.length > 0
      ? totalDocumentationCompleteness / packagePaths.length
      : 100;

  return {
    passed: allErrors.length === 0,
    errors: allErrors,
    warnings: [],
    metrics: {
      documentationCompleteness: avgDocumentationCompleteness,
      testCoverage: 0,
      exampleCoverage: 0,
      crossReferenceValidity: 0,
    },
  };
}

/**
 * Generate a detailed error report for undocumented exports
 * @param packagePath - Path to the package directory
 * @returns Formatted error report string
 */
export function generateErrorReport(packagePath: string): string {
  const result = validateExportsDocumented(packagePath);
  const packageDoc = analyzePackage(packagePath);

  let report = `\n=== Export Documentation Report ===\n`;
  report += `Package: ${packageDoc.packageName}\n`;
  report += `Total Exports: ${packageDoc.exports.length}\n`;
  report += `Documented: ${
    packageDoc.exports.filter((e) => e.isDocumented).length
  }\n`;
  report += `Undocumented: ${result.errors.length}\n`;
  report += `Completeness: ${result.metrics.documentationCompleteness.toFixed(
    1
  )}%\n`;
  report += `\n`;

  if (result.errors.length > 0) {
    report += `Undocumented Exports:\n`;
    report += `${'='.repeat(50)}\n`;

    for (const error of result.errors) {
      report += `\n`;
      report += `❌ ${error.message}\n`;
      report += `   Location: ${error.location}\n`;
      report += `   Recommendation: ${error.recommendation}\n`;
    }
  } else {
    report += `✅ All exports are documented!\n`;
  }

  return report;
}

/**
 * Validate exports and exit with appropriate code for CI/CD
 * @param packagePath - Path to the package directory
 * @param exitOnError - Whether to exit process on validation failure
 * @returns Validation result
 */
export function validateForCI(
  packagePath: string,
  exitOnError: boolean = true
): ValidationResult {
  const result = validateExportsDocumented(packagePath);

  // Print report
  console.log(generateErrorReport(packagePath));

  // Exit with error code if validation failed
  if (!result.passed && exitOnError) {
    process.exit(1);
  }

  return result;
}

/**
 * Find all packages in the monorepo
 * @param monorepoRoot - Path to the monorepo root directory
 * @returns Array of package directory paths
 */
export function findAllPackages(monorepoRoot: string): string[] {
  const packagesDir = path.join(monorepoRoot, 'packages');
  const packages: string[] = [];

  if (!fs.existsSync(packagesDir)) {
    return packages;
  }

  const entries = fs.readdirSync(packagesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const packagePath = path.join(packagesDir, entry.name);
      const packageJsonPath = path.join(packagePath, 'package.json');

      // Only include directories with package.json
      if (fs.existsSync(packageJsonPath)) {
        packages.push(packagePath);
      }
    }
  }

  return packages;
}

/**
 * Validate all packages in the monorepo
 * @param monorepoRoot - Path to the monorepo root directory
 * @param exitOnError - Whether to exit process on validation failure
 * @returns Aggregated validation result
 */
export function validateAllPackages(
  monorepoRoot: string,
  exitOnError: boolean = true
): ValidationResult {
  const packages = findAllPackages(monorepoRoot);

  console.log(`\nFound ${packages.length} packages to validate\n`);

  const results: ValidationResult[] = [];

  for (const packagePath of packages) {
    const packageName = path.basename(packagePath);
    console.log(`Validating ${packageName}...`);

    const result = validateExportsDocumented(packagePath);
    results.push(result);

    if (result.errors.length > 0) {
      console.log(`  ❌ ${result.errors.length} undocumented exports`);
    } else {
      console.log(`  ✅ All exports documented`);
    }
  }

  // Aggregate results
  const allErrors = results.flatMap((r) => r.errors);
  const avgCompleteness =
    results.reduce((sum, r) => sum + r.metrics.documentationCompleteness, 0) /
    results.length;

  const aggregatedResult: ValidationResult = {
    passed: allErrors.length === 0,
    errors: allErrors,
    warnings: [],
    metrics: {
      documentationCompleteness: avgCompleteness,
      testCoverage: 0,
      exampleCoverage: 0,
      crossReferenceValidity: 0,
    },
  };

  // Print summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Summary:`);
  console.log(`  Total Packages: ${packages.length}`);
  console.log(
    `  Packages with Issues: ${results.filter((r) => !r.passed).length}`
  );
  console.log(`  Total Undocumented Exports: ${allErrors.length}`);
  console.log(
    `  Average Documentation Completeness: ${avgCompleteness.toFixed(1)}%`
  );
  console.log(`${'='.repeat(50)}\n`);

  // Exit with error code if validation failed
  if (!aggregatedResult.passed && exitOnError) {
    process.exit(1);
  }

  return aggregatedResult;
}

/**
 * Get undocumented exports from a validation result
 * @param result - Validation result
 * @returns Array of error messages for undocumented exports
 */
export function getUndocumentedExports(result: ValidationResult): string[] {
  return result.errors
    .filter((e) => e.type === 'UndocumentedExportError')
    .map((e) => e.message);
}

/**
 * Check if a specific export is documented
 * @param packagePath - Path to the package directory
 * @param exportName - Name of the export to check
 * @returns True if the export is documented, false otherwise
 */
export function isExportDocumented(
  packagePath: string,
  exportName: string
): boolean {
  const packageDoc = analyzePackage(packagePath);
  const exportSymbol = packageDoc.exports.find((e) => e.name === exportName);

  return exportSymbol ? exportSymbol.isDocumented : false;
}

/**
 * Get all undocumented exports for a package
 * @param packagePath - Path to the package directory
 * @returns Array of undocumented export symbols
 */
export function getUndocumentedExportSymbols(
  packagePath: string
): ExportedSymbol[] {
  const packageDoc = analyzePackage(packagePath);
  return packageDoc.exports.filter((exp) => !exp.isDocumented);
}
