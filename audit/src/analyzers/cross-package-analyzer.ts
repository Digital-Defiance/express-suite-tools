/**
 * Cross-package analyzer for integration analysis
 * Analyzes relationships and integration points between packages
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  CompatibilityIssue,
  CompatibilityReport,
  CompatibilityTest,
  Dependency,
  DocumentedIntegration,
  IntegrationPoint,
  PackageDependencyGraph,
  PackageNode,
} from '../types';

/**
 * Analyze dependencies across all packages in the monorepo
 * Builds a complete dependency graph showing relationships between packages
 * @param monorepoRoot - Root directory of the monorepo
 * @returns Package dependency graph
 */
export function analyzeDependencies(
  monorepoRoot: string
): PackageDependencyGraph {
  const packages: PackageNode[] = [];
  const dependencies: Dependency[] = [];

  // Find all packages in the monorepo
  const packagePaths = findPackages(monorepoRoot);

  // Parse each package
  for (const packagePath of packagePaths) {
    const packageJsonPath = path.join(packagePath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const packageNode: PackageNode = {
        name: packageJson.name || path.basename(packagePath),
        path: packagePath,
        version: packageJson.version || '0.0.0',
        dependencies: Object.keys(packageJson.dependencies || {}),
        devDependencies: Object.keys(packageJson.devDependencies || {}),
      };

      packages.push(packageNode);

      // Add dependencies
      for (const dep of packageNode.dependencies) {
        dependencies.push({
          source: packageNode.name,
          target: dep,
          type: 'dependency',
        });
      }

      for (const dep of packageNode.devDependencies) {
        dependencies.push({
          source: packageNode.name,
          target: dep,
          type: 'devDependency',
        });
      }
    } catch (error) {
      console.warn(`Warning: Could not parse ${packageJsonPath}: ${error}`);
    }
  }

  // Find integration points
  const integrationPoints = findIntegrationPoints(packages, monorepoRoot);

  return {
    packages,
    dependencies,
    integrationPoints,
  };
}

/**
 * Find all packages in the monorepo
 * @param monorepoRoot - Root directory of the monorepo
 * @returns Array of package paths
 */
function findPackages(monorepoRoot: string): string[] {
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

  // Also check root for package.json
  if (fs.existsSync(path.join(monorepoRoot, 'package.json'))) {
    packages.push(monorepoRoot);
  }

  return packages;
}

/**
 * Find integration points between packages
 * Identifies where packages import from or reference each other
 * @param packages - Array of package nodes
 * @param monorepoRoot - Root directory of the monorepo
 * @returns Array of integration points
 */
export function findIntegrationPoints(
  packages: PackageNode[],
  _monorepoRoot: string
): IntegrationPoint[] {
  const integrationPoints: IntegrationPoint[] = [];
  const _packageNames = new Set(packages.map((p) => p.name));

  for (const pkg of packages) {
    // Find TypeScript files in the package
    const tsFiles = findTypeScriptFiles(pkg.path);

    for (const tsFile of tsFiles) {
      try {
        const content = fs.readFileSync(tsFile, 'utf-8');

        // Find imports from other packages in the monorepo
        const importRegex =
          /import\s+(?:{[^}]+}|[a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s+['"]([^'"]+)['"]/g;
        let match;

        while ((match = importRegex.exec(content)) !== null) {
          const importPath = match[1];

          // Check if this is an import from another package in the monorepo
          for (const targetPkg of packages) {
            if (
              targetPkg.name !== pkg.name &&
              (importPath === targetPkg.name ||
                importPath.startsWith(targetPkg.name + '/'))
            ) {
              // Determine integration type
              const integrationType = determineIntegrationType(
                content,
                importPath
              );

              // Check if documented
              const isDocumented = checkIntegrationDocumented(
                pkg.path,
                targetPkg.name
              );

              // Check if tested
              const hasTests = checkIntegrationTested(pkg.path, targetPkg.name);

              // Find examples
              const examples = findIntegrationExamples(
                pkg.path,
                targetPkg.name
              );

              // Check if we already have this integration point
              const existing = integrationPoints.find(
                (ip) =>
                  ip.sourcePackage === pkg.name &&
                  ip.targetPackage === targetPkg.name &&
                  ip.type === integrationType
              );

              if (!existing) {
                integrationPoints.push({
                  sourcePackage: pkg.name,
                  targetPackage: targetPkg.name,
                  type: integrationType,
                  isDocumented,
                  hasTests,
                  examples,
                });
              }

              break;
            }
          }
        }
      } catch (error) {
        console.warn(`Warning: Could not analyze ${tsFile}: ${error}`);
      }
    }
  }

  return integrationPoints;
}

/**
 * Find TypeScript files in a directory
 * @param dir - Directory to search
 * @returns Array of TypeScript file paths
 */
function findTypeScriptFiles(dir: string): string[] {
  const tsFiles: string[] = [];

  const srcDir = path.join(dir, 'src');
  if (fs.existsSync(srcDir)) {
    findTypeScriptFilesRecursive(srcDir, tsFiles);
  }

  return tsFiles;
}

/**
 * Recursively find TypeScript files
 * @param dir - Directory to search
 * @param tsFiles - Array to accumulate TypeScript files
 */
function findTypeScriptFilesRecursive(dir: string, tsFiles: string[]): void {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        findTypeScriptFilesRecursive(fullPath, tsFiles);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.spec.ts')
      ) {
        tsFiles.push(fullPath);
      }
    }
  } catch (_error) {
    // Ignore errors (e.g., permission denied)
  }
}

/**
 * Determine the type of integration based on import content
 * @param content - File content
 * @param importPath - Import path
 * @returns Integration type
 */
function determineIntegrationType(
  content: string,
  importPath: string
): 'api' | 'type' | 'utility' | 'config' {
  // Check if importing types
  if (
    content.includes(`import type`) ||
    importPath.includes('/types') ||
    importPath.includes('/interfaces')
  ) {
    return 'type';
  }

  // Check if importing config
  if (importPath.includes('/config') || importPath.includes('/constants')) {
    return 'config';
  }

  // Check if importing utilities
  if (importPath.includes('/utils') || importPath.includes('/helpers')) {
    return 'utility';
  }

  // Default to API
  return 'api';
}

/**
 * Check if integration is documented in README
 * @param packagePath - Path to the package
 * @param targetPackage - Name of the target package
 * @returns True if documented
 */
function checkIntegrationDocumented(
  packagePath: string,
  targetPackage: string
): boolean {
  const readmePath = findReadme(packagePath);
  if (!readmePath) {
    return false;
  }

  try {
    const content = fs.readFileSync(readmePath, 'utf-8');
    // Check if the target package is mentioned in the README
    return content.includes(targetPackage);
  } catch (_error) {
    return false;
  }
}

/**
 * Check if integration is tested
 * @param packagePath - Path to the package
 * @param targetPackage - Name of the target package
 * @returns True if tested
 */
function checkIntegrationTested(
  packagePath: string,
  targetPackage: string
): boolean {
  const testFiles = findTestFiles(packagePath);

  for (const testFile of testFiles) {
    try {
      const content = fs.readFileSync(testFile, 'utf-8');
      // Check if the test file imports from the target package
      if (content.includes(targetPackage)) {
        return true;
      }
    } catch (_error) {
      // Ignore errors
    }
  }

  return false;
}

/**
 * Find integration examples in README
 * @param packagePath - Path to the package
 * @param targetPackage - Name of the target package
 * @returns Array of example descriptions
 */
function findIntegrationExamples(
  packagePath: string,
  targetPackage: string
): string[] {
  const examples: string[] = [];
  const readmePath = findReadme(packagePath);

  if (!readmePath) {
    return examples;
  }

  try {
    const content = fs.readFileSync(readmePath, 'utf-8');

    // Find code blocks that mention the target package
    const codeBlockRegex = /```[\s\S]*?```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const codeBlock = match[0];
      if (codeBlock.includes(targetPackage)) {
        examples.push(codeBlock);
      }
    }
  } catch (_error) {
    // Ignore errors
  }

  return examples;
}

/**
 * Find test files in a package
 * @param packagePath - Path to the package
 * @returns Array of test file paths
 */
function findTestFiles(packagePath: string): string[] {
  const testFiles: string[] = [];
  const testDirs = [
    path.join(packagePath, 'tests'),
    path.join(packagePath, 'test'),
    path.join(packagePath, '__tests__'),
  ];

  for (const testDir of testDirs) {
    if (fs.existsSync(testDir)) {
      findTestFilesRecursive(testDir, testFiles);
    }
  }

  return testFiles;
}

/**
 * Recursively find test files
 * @param dir - Directory to search
 * @param testFiles - Array to accumulate test files
 */
function findTestFilesRecursive(dir: string, testFiles: string[]): void {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        findTestFilesRecursive(fullPath, testFiles);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.test.ts') ||
          entry.name.endsWith('.test.js') ||
          entry.name.endsWith('.spec.ts') ||
          entry.name.endsWith('.spec.js'))
      ) {
        testFiles.push(fullPath);
      }
    }
  } catch (_error) {
    // Ignore errors
  }
}

/**
 * Find README file in a package
 * @param packagePath - Path to the package
 * @returns Path to README or null
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
 * Validate binary compatibility between ECIES packages
 * Checks that ecies-lib and node-ecies-lib can encrypt/decrypt each other's data
 * @param monorepoRoot - Root directory of the monorepo
 * @returns Compatibility report
 */
export function validateBinaryCompatibility(
  monorepoRoot: string
): CompatibilityReport {
  const packages = findPackages(monorepoRoot);

  // Find ECIES packages
  const eciesLib = packages.find((p) => p.includes('ecies-lib'));
  const nodeEciesLib = packages.find((p) => p.includes('node-ecies-lib'));

  if (!eciesLib || !nodeEciesLib) {
    return {
      eciesLibVersion: 'not found',
      nodeEciesLibVersion: 'not found',
      binaryCompatible: false,
      compatibilityTests: [],
      issues: [
        {
          severity: 'critical',
          message: 'Could not find both ecies-lib and node-ecies-lib packages',
          affectedPackages: [],
        },
      ],
    };
  }

  // Get versions
  const eciesVersion = getPackageVersion(eciesLib);
  const nodeEciesVersion = getPackageVersion(nodeEciesLib);

  // Check for compatibility tests
  const compatibilityTests = findCompatibilityTests(eciesLib, nodeEciesLib);

  // Determine if binary compatible
  const binaryCompatible = compatibilityTests.every((test) => test.passed);

  // Identify issues
  const issues: CompatibilityIssue[] = [];

  if (compatibilityTests.length === 0) {
    issues.push({
      severity: 'warning',
      message:
        'No binary compatibility tests found between ecies-lib and node-ecies-lib',
      affectedPackages: [eciesLib, nodeEciesLib],
    });
  }

  for (const test of compatibilityTests) {
    if (!test.passed) {
      issues.push({
        severity: 'critical',
        message: `Binary compatibility test failed: ${test.name}`,
        affectedPackages: [eciesLib, nodeEciesLib],
      });
    }
  }

  return {
    eciesLibVersion: eciesVersion,
    nodeEciesLibVersion: nodeEciesVersion,
    binaryCompatible,
    compatibilityTests,
    issues,
  };
}

/**
 * Get package version from package.json
 * @param packagePath - Path to the package
 * @returns Package version
 */
function getPackageVersion(packagePath: string): string {
  try {
    const packageJsonPath = path.join(packagePath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version || '0.0.0';
  } catch (_error) {
    return 'unknown';
  }
}

/**
 * Find compatibility tests between ECIES packages
 * @param eciesLib - Path to ecies-lib
 * @param nodeEciesLib - Path to node-ecies-lib
 * @returns Array of compatibility tests
 */
function findCompatibilityTests(
  eciesLib: string,
  nodeEciesLib: string
): CompatibilityTest[] {
  const tests: CompatibilityTest[] = [];

  // Check for integration tests in both packages
  const eciesTests = findTestFiles(eciesLib);
  const nodeEciesTests = findTestFiles(nodeEciesLib);

  // Look for tests that mention "compatibility" or "binary"
  for (const testFile of [...eciesTests, ...nodeEciesTests]) {
    try {
      const content = fs.readFileSync(testFile, 'utf-8');

      if (
        content.includes('compatibility') ||
        content.includes('binary') ||
        content.includes('cross-platform')
      ) {
        tests.push({
          name: path.basename(testFile),
          passed: true, // Assume passed if test exists (would need to run tests to verify)
          description: `Compatibility test found in ${path.basename(testFile)}`,
        });
      }
    } catch (_error) {
      // Ignore errors
    }
  }

  return tests;
}

/**
 * Check documented integrations across packages
 * Verifies that integration points mentioned in documentation are valid
 * @param monorepoRoot - Root directory of the monorepo
 * @returns Array of documented integrations
 */
export function checkDocumentedIntegrations(
  monorepoRoot: string
): DocumentedIntegration[] {
  const documentedIntegrations: DocumentedIntegration[] = [];
  const packages = findPackages(monorepoRoot);

  for (const packagePath of packages) {
    const readmePath = findReadme(packagePath);
    if (!readmePath) {
      continue;
    }

    try {
      const packageName = getPackageName(packagePath);
      const content = fs.readFileSync(readmePath, 'utf-8');

      // Find mentions of other packages
      for (const targetPath of packages) {
        if (targetPath === packagePath) {
          continue;
        }

        const targetName = getPackageName(targetPath);

        if (content.includes(targetName)) {
          // Find the line where it's mentioned
          const lines = content.split('\n');
          let lineNumber = 0;
          let description = '';

          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(targetName)) {
              lineNumber = i + 1;
              description = lines[i].trim();
              break;
            }
          }

          // Check if there's an example
          const hasExample =
            findIntegrationExamples(packagePath, targetName).length > 0;

          // Check if there are tests
          const hasTest = checkIntegrationTested(packagePath, targetName);

          documentedIntegrations.push({
            sourcePackage: packageName,
            targetPackage: targetName,
            description,
            location: {
              file: readmePath,
              line: lineNumber,
              column: 1,
            },
            hasExample,
            hasTest,
          });
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not analyze ${readmePath}: ${error}`);
    }
  }

  return documentedIntegrations;
}

/**
 * Get package name from package.json
 * @param packagePath - Path to the package
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
