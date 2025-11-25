/**
 * Tests for audit orchestrator
 * Verifies that the orchestrator correctly coordinates all analysis phases
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  AuditOptions,
  runFullAudit,
  runIncrementalAudit,
  runPackageAudit,
} from '../src/orchestrator';

describe('Audit Orchestrator', () => {
  let tempMonorepoRoot: string;
  let package1Path: string;
  let package2Path: string;

  beforeEach(() => {
    // Create a temporary monorepo structure
    tempMonorepoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
    const packagesDir = path.join(tempMonorepoRoot, 'packages');
    fs.mkdirSync(packagesDir);

    // Create package 1
    package1Path = path.join(packagesDir, 'package1');
    fs.mkdirSync(package1Path);
    fs.mkdirSync(path.join(package1Path, 'src'));

    fs.writeFileSync(
      path.join(package1Path, 'package.json'),
      JSON.stringify({ name: 'package1', version: '1.0.0' })
    );

    fs.writeFileSync(
      path.join(package1Path, 'src', 'index.ts'),
      'export function func1(): void {}'
    );

    fs.writeFileSync(
      path.join(package1Path, 'README.md'),
      `
# Package 1

## API

### func1()

A test function.

\`\`\`typescript
import { func1 } from 'package1';
func1();
\`\`\`
      `.trim()
    );

    // Create package 2
    package2Path = path.join(packagesDir, 'package2');
    fs.mkdirSync(package2Path);
    fs.mkdirSync(path.join(package2Path, 'src'));

    fs.writeFileSync(
      path.join(package2Path, 'package.json'),
      JSON.stringify({ name: 'package2', version: '1.0.0' })
    );

    fs.writeFileSync(
      path.join(package2Path, 'src', 'index.ts'),
      'export function func2(): void {}'
    );

    // Package 2 has no README (undocumented)
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempMonorepoRoot)) {
      fs.rmSync(tempMonorepoRoot, { recursive: true, force: true });
    }
  });

  describe('runPackageAudit', () => {
    it('should audit a single package', () => {
      const options: AuditOptions = {
        includeCoverage: false, // Skip coverage for speed
        includeCrossPackage: false,
        validateExamples: true,
        validateReferences: false,
        verbose: false,
      };

      const result = runPackageAudit(package1Path, options);

      expect(result.packageName).toBe('package1');
      expect(result.documentation).toBeDefined();
      expect(result.coverage).toBeDefined();
      expect(result.quality).toBeDefined();
      expect(result.issues).toBeDefined();

      // Package 1 should have exports
      expect(result.documentation.exports.length).toBeGreaterThan(0);

      // Package 1 should have documentation
      expect(result.documentation.documentedSymbols.length).toBeGreaterThan(0);

      // Package 1 should have examples
      expect(result.documentation.examples.length).toBeGreaterThan(0);
    });

    it('should identify undocumented exports', () => {
      const options: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      const result = runPackageAudit(package2Path, options);

      expect(result.packageName).toBe('package2');

      // Package 2 has no README, so should have undocumented exports
      const undocumentedErrors = result.issues.filter(
        (issue) => issue.type === 'UndocumentedExportError'
      );

      expect(undocumentedErrors.length).toBeGreaterThan(0);
    });

    it('should identify missing examples', () => {
      const options: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      const result = runPackageAudit(package2Path, options);

      // Package 2 has no examples
      const missingExampleErrors = result.issues.filter(
        (issue) => issue.type === 'MissingExampleError'
      );

      expect(missingExampleErrors.length).toBeGreaterThan(0);
    });

    it('should handle packages without src directory', () => {
      const emptyPackagePath = path.join(
        tempMonorepoRoot,
        'packages',
        'empty-package'
      );
      fs.mkdirSync(emptyPackagePath);
      fs.writeFileSync(
        path.join(emptyPackagePath, 'package.json'),
        JSON.stringify({ name: 'empty-package' })
      );

      const options: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      const result = runPackageAudit(emptyPackagePath, options);

      expect(result.packageName).toBe('empty-package');
      expect(result.documentation.exports).toEqual([]);
    });
  });

  describe('runFullAudit', () => {
    it('should audit all packages in monorepo', () => {
      const options: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      const report = runFullAudit(tempMonorepoRoot, options);

      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.packages).toHaveLength(2);
      expect(report.summary).toBeDefined();
      expect(report.recommendations).toBeDefined();

      // Check summary
      expect(report.summary.totalPackages).toBe(2);
      expect(report.summary.packagesWithIssues).toBeGreaterThan(0);
      expect(report.summary.overallDocumentationScore).toBeGreaterThanOrEqual(
        0
      );
      expect(report.summary.overallDocumentationScore).toBeLessThanOrEqual(100);
    });

    it('should exclude specified packages', () => {
      const options: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        excludePackages: ['package2'],
        verbose: false,
      };

      const report = runFullAudit(tempMonorepoRoot, options);

      expect(report.packages).toHaveLength(1);
      expect(report.packages[0].packageName).toBe('package1');
    });

    it('should generate recommendations', () => {
      const options: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      const report = runFullAudit(tempMonorepoRoot, options);

      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);

      // Should have recommendations for undocumented exports
      const docRecommendations = report.recommendations.filter(
        (r) => r.category === 'Documentation'
      );

      expect(docRecommendations.length).toBeGreaterThan(0);
    });

    it('should calculate overall scores', () => {
      const options: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      const report = runFullAudit(tempMonorepoRoot, options);

      // Overall documentation score should be between 0 and 100
      expect(report.summary.overallDocumentationScore).toBeGreaterThanOrEqual(
        0
      );
      expect(report.summary.overallDocumentationScore).toBeLessThanOrEqual(100);

      // Package 1 is documented, package 2 is not, so score should be around 50%
      expect(report.summary.overallDocumentationScore).toBeGreaterThan(25);
      expect(report.summary.overallDocumentationScore).toBeLessThan(75);
    });

    it('should count critical issues and warnings', () => {
      const options: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      const report = runFullAudit(tempMonorepoRoot, options);

      // Should have some critical issues (undocumented exports)
      expect(report.summary.criticalIssues).toBeGreaterThan(0);

      // Should have some warnings (missing examples)
      expect(report.summary.warnings).toBeGreaterThan(0);
    });
  });

  describe('runIncrementalAudit', () => {
    it('should audit only affected packages', () => {
      const changedFiles = [
        path.join('packages', 'package1', 'src', 'index.ts'),
      ];

      const options: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      const report = runIncrementalAudit(
        tempMonorepoRoot,
        changedFiles,
        options
      );

      // Should only audit package1
      expect(report.packages).toHaveLength(1);
      expect(report.packages[0].packageName).toBe('package1');
    });

    it('should handle multiple affected packages', () => {
      const changedFiles = [
        path.join('packages', 'package1', 'src', 'index.ts'),
        path.join('packages', 'package2', 'src', 'index.ts'),
      ];

      const options: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      const report = runIncrementalAudit(
        tempMonorepoRoot,
        changedFiles,
        options
      );

      // Should audit both packages
      expect(report.packages).toHaveLength(2);
    });

    it('should handle no affected packages', () => {
      const changedFiles = [path.join('docs', 'README.md')];

      const options: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      const report = runIncrementalAudit(
        tempMonorepoRoot,
        changedFiles,
        options
      );

      // Should audit no packages
      expect(report.packages).toHaveLength(0);
    });

    it('should handle absolute paths', () => {
      const changedFiles = [path.join(package1Path, 'src', 'index.ts')];

      const options: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      const report = runIncrementalAudit(
        tempMonorepoRoot,
        changedFiles,
        options
      );

      // Should audit package1
      expect(report.packages).toHaveLength(1);
      expect(report.packages[0].packageName).toBe('package1');
    });
  });

  describe('Audit Options', () => {
    it('should respect includeCoverage option', () => {
      const optionsWithCoverage: AuditOptions = {
        includeCoverage: true,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      const optionsWithoutCoverage: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      // Both should work without errors
      const resultWith = runPackageAudit(package1Path, optionsWithCoverage);
      const resultWithout = runPackageAudit(
        package1Path,
        optionsWithoutCoverage
      );

      expect(resultWith.coverage).toBeDefined();
      expect(resultWithout.coverage).toBeDefined();
    });

    it('should respect validateExamples option', () => {
      const optionsWithValidation: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: true,
        validateReferences: false,
        verbose: false,
      };

      const optionsWithoutValidation: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      const resultWith = runPackageAudit(package1Path, optionsWithValidation);
      const resultWithout = runPackageAudit(
        package1Path,
        optionsWithoutValidation
      );

      // Both should work
      expect(resultWith.issues).toBeDefined();
      expect(resultWithout.issues).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent package path gracefully', () => {
      const nonExistentPath = path.join(tempMonorepoRoot, 'non-existent');

      const options: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      // Should not throw
      expect(() => runPackageAudit(nonExistentPath, options)).not.toThrow();
    });

    it('should handle package without package.json', () => {
      const packageWithoutJson = path.join(
        tempMonorepoRoot,
        'packages',
        'no-json'
      );
      fs.mkdirSync(packageWithoutJson);
      fs.mkdirSync(path.join(packageWithoutJson, 'src'));

      const options: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      // Should not throw
      expect(() => runPackageAudit(packageWithoutJson, options)).not.toThrow();
    });
  });

  describe('Integration', () => {
    it('should produce consistent results across multiple runs', () => {
      const options: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: false,
        validateReferences: false,
        verbose: false,
      };

      const result1 = runPackageAudit(package1Path, options);
      const result2 = runPackageAudit(package1Path, options);

      // Results should be consistent
      expect(result1.packageName).toBe(result2.packageName);
      expect(result1.documentation.exports.length).toBe(
        result2.documentation.exports.length
      );
      expect(result1.issues.length).toBe(result2.issues.length);
    });

    it('should handle full audit workflow', () => {
      const options: AuditOptions = {
        includeCoverage: false,
        includeCrossPackage: false,
        validateExamples: true,
        validateReferences: false,
        verbose: false,
      };

      // Run full audit
      const report = runFullAudit(tempMonorepoRoot, options);

      // Verify report structure
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.packages.length).toBeGreaterThan(0);
      expect(report.summary.totalPackages).toBe(report.packages.length);

      // Verify each package result
      for (const packageResult of report.packages) {
        expect(packageResult.packageName).toBeTruthy();
        expect(packageResult.documentation).toBeDefined();
        expect(packageResult.coverage).toBeDefined();
        expect(packageResult.quality).toBeDefined();
        expect(Array.isArray(packageResult.issues)).toBe(true);
      }

      // Verify recommendations
      expect(Array.isArray(report.recommendations)).toBe(true);
      for (const recommendation of report.recommendations) {
        expect(recommendation.priority).toMatch(/^(high|medium|low)$/);
        expect(recommendation.category).toBeTruthy();
        expect(recommendation.message).toBeTruthy();
        expect(Array.isArray(recommendation.affectedPackages)).toBe(true);
        expect(Array.isArray(recommendation.actionItems)).toBe(true);
      }
    });
  });
});
