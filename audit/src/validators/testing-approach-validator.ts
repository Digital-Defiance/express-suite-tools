/**
 * Testing approach documentation validator
 * Validates that packages have testing sections, test pattern examples, and cross-package test documentation
 */

import * as fs from 'fs';
import * as path from 'path';
import { ValidationError } from '../types';

/**
 * Result of testing approach validation
 */
export interface TestingApproachValidationResult {
  packageName: string;
  hasTestingSection: boolean;
  hasTestPatternExamples: boolean;
  hasCrossPackageTestDocs: boolean;
  testingSectionLocation?: { line: number; column: number };
  testPatternExamples: TestPatternExample[];
  crossPackageTestDocs: CrossPackageTestDoc[];
  errors: ValidationError[];
}

/**
 * Represents a test pattern example found in documentation
 */
export interface TestPatternExample {
  pattern: string;
  code: string;
  location: { line: number; column: number };
}

/**
 * Represents cross-package test documentation
 */
export interface CrossPackageTestDoc {
  description: string;
  packages: string[];
  location: { line: number; column: number };
}

/**
 * Check if a package README has a testing section
 * @param readmePath - Path to the README file
 * @returns Object with hasTestingSection flag and location if found
 */
export function hasTestingSection(readmePath: string): {
  hasSection: boolean;
  location?: { line: number; column: number };
} {
  if (!fs.existsSync(readmePath)) {
    return { hasSection: false };
  }

  const content = fs.readFileSync(readmePath, 'utf-8');
  const lines = content.split('\n');

  // Look for testing-related section headers
  const testingSectionPatterns = [
    /^#+\s+testing/i,
    /^#+\s+tests/i,
    /^#+\s+test\s+approach/i,
    /^#+\s+testing\s+approach/i,
    /^#+\s+testing\s+strategy/i,
    /^#+\s+running\s+tests/i,
    /^#+\s+how\s+to\s+test/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of testingSectionPatterns) {
      if (pattern.test(line)) {
        return {
          hasSection: true,
          location: { line: i + 1, column: 1 },
        };
      }
    }
  }

  return { hasSection: false };
}

/**
 * Extract test pattern examples from README
 * @param readmePath - Path to the README file
 * @returns Array of test pattern examples found
 */
export function extractTestPatternExamples(
  readmePath: string
): TestPatternExample[] {
  if (!fs.existsSync(readmePath)) {
    return [];
  }

  const content = fs.readFileSync(readmePath, 'utf-8');
  const lines = content.split('\n');
  const examples: TestPatternExample[] = [];

  let inCodeBlock = false;
  let codeBlockStart = -1;
  let codeBlockLanguage = '';
  let codeBlockContent: string[] = [];
  let inTestingSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if we're entering a testing section
    if (/^#+\s+(testing|tests|test\s+approach)/i.test(line)) {
      inTestingSection = true;
    }

    // Check if we're leaving the testing section (new major section that's not test-related)
    if (
      inTestingSection &&
      /^#+\s+(?!.*test)/i.test(line) &&
      !/^#+\s+(testing|tests|test\s+approach)/i.test(line)
    ) {
      inTestingSection = false;
    }

    // Detect code block start/end
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        // Starting a code block
        inCodeBlock = true;
        codeBlockStart = i + 1;
        codeBlockLanguage = line.substring(3).trim();
        codeBlockContent = [];
      } else {
        // Ending a code block
        inCodeBlock = false;

        // Check if this is a test-related code block
        const code = codeBlockContent.join('\n');
        const isTestCode =
          /\b(test|describe|it|expect|assert|jest|vitest|mocha)\b/i.test(
            code
          ) || /\.(test|spec)\.(ts|js|tsx|jsx)/.test(code);

        if (isTestCode && code.trim().length > 0) {
          examples.push({
            pattern: determineTestPattern(code),
            code,
            location: { line: codeBlockStart, column: 1 },
          });
        }

        codeBlockContent = [];
      }
    } else if (inCodeBlock) {
      codeBlockContent.push(line);
    }
  }

  return examples;
}

/**
 * Determine the test pattern from code content
 * @param code - Code content to analyze
 * @returns Pattern name
 */
function determineTestPattern(code: string): string {
  if (/describe\s*\(/.test(code) && /it\s*\(/.test(code)) {
    return 'BDD-style (describe/it)';
  }
  if (/test\s*\(/.test(code)) {
    return 'test() function';
  }
  if (/expect\s*\(/.test(code)) {
    return 'Assertion pattern';
  }
  if (/mock|spy|stub/i.test(code)) {
    return 'Mocking pattern';
  }
  if (/beforeEach|afterEach|beforeAll|afterAll/.test(code)) {
    return 'Setup/teardown pattern';
  }
  if (/integration|e2e/i.test(code)) {
    return 'Integration test pattern';
  }
  return 'General test pattern';
}

/**
 * Extract cross-package test documentation from README
 * @param readmePath - Path to the README file
 * @param packageName - Name of the current package
 * @returns Array of cross-package test documentation found
 */
export function extractCrossPackageTestDocs(
  readmePath: string,
  packageName: string
): CrossPackageTestDoc[] {
  if (!fs.existsSync(readmePath)) {
    return [];
  }

  const content = fs.readFileSync(readmePath, 'utf-8');
  const lines = content.split('\n');
  const docs: CrossPackageTestDoc[] = [];

  let inTestingSection = false;
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if we're in a testing section
    if (/^#+\s+(testing|tests|test\s+approach)/i.test(line)) {
      inTestingSection = true;
      currentSection = line;
      continue; // Skip processing the header line itself
    }

    // Check if we're leaving the testing section (new major section that's not test-related)
    // Only leave if it's a header at the same or higher level and doesn't contain test-related keywords
    if (inTestingSection && /^##\s+(?!.*test|.*cross)/i.test(line)) {
      inTestingSection = false;
      continue;
    }

    // Look for cross-package references in testing context
    if (inTestingSection) {
      // Extract all package references from the line
      const packagePattern = /@(?:digitaldefiance|express-suite)\/[a-z0-9-]+/g;
      const matches = line.match(packagePattern);
      const packages = matches ? Array.from(new Set(matches)) : [];

      // Pattern 1: Explicit cross-package or integration mentions with package references
      if (
        /cross[- ]package|integration|multi[- ]package|inter[- ]package/i.test(
          line
        ) &&
        packages.length > 0
      ) {
        docs.push({
          description: line.trim(),
          packages,
          location: { line: i + 1, column: 1 },
        });
      }
      // Pattern 2: Lines with package references (even without explicit cross-package mention)
      else if (packages.length > 0) {
        // Only consider it cross-package if it references other packages
        const otherPackages = packages.filter((pkg) => pkg !== packageName);
        if (otherPackages.length > 0) {
          docs.push({
            description: line.trim(),
            packages: otherPackages,
            location: { line: i + 1, column: 1 },
          });
        }
      }
      // Pattern 3: Generic cross-package mentions without specific packages
      else if (
        /cross[- ]package|integration|multi[- ]package|inter[- ]package/i.test(
          line
        )
      ) {
        docs.push({
          description: line.trim(),
          packages: [],
          location: { line: i + 1, column: 1 },
        });
      }
    }
  }

  return docs;
}

/**
 * Check if a package has cross-package dependencies
 * @param packagePath - Path to the package
 * @returns True if package has cross-package dependencies
 */
export function hasCrossPackageDependencies(packagePath: string): boolean {
  const packageJsonPath = path.join(packagePath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Check for Express Suite packages
    const expressPackagePattern = /^@(digitaldefiance|express-suite)\//;
    return Object.keys(allDeps).some((dep) => expressPackagePattern.test(dep));
  } catch (error) {
    return false;
  }
}

/**
 * Validate testing approach documentation for a package
 * @param packagePath - Path to the package
 * @returns Validation result with errors and metrics
 */
export function validateTestingApproach(
  packagePath: string
): TestingApproachValidationResult {
  const errors: ValidationError[] = [];

  // Read package.json to get package name
  const packageJsonPath = path.join(packagePath, 'package.json');
  let packageName = 'unknown';
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      packageName = packageJson.name || 'unknown';
    } catch (error) {
      // Use default name if parsing fails
    }
  }

  // Check README exists
  const readmePath = path.join(packagePath, 'README.md');
  if (!fs.existsSync(readmePath)) {
    errors.push({
      type: 'MissingReadme',
      severity: 'critical',
      message: `README.md not found in ${packagePath}`,
      recommendation: 'Create a README.md file with testing documentation',
    });

    return {
      packageName,
      hasTestingSection: false,
      hasTestPatternExamples: false,
      hasCrossPackageTestDocs: false,
      testPatternExamples: [],
      crossPackageTestDocs: [],
      errors,
    };
  }

  // Check for testing section
  const testingSection = hasTestingSection(readmePath);
  if (!testingSection.hasSection) {
    errors.push({
      type: 'MissingTestingSection',
      severity: 'warning',
      message: `Package '${packageName}' README does not have a testing section`,
      location: readmePath,
      recommendation:
        'Add a "Testing" section to the README documenting the testing approach',
    });
  }

  // Extract test pattern examples
  const testPatternExamples = extractTestPatternExamples(readmePath);
  if (testPatternExamples.length === 0) {
    errors.push({
      type: 'MissingTestPatternExamples',
      severity: 'warning',
      message: `Package '${packageName}' README does not have test pattern examples`,
      location: readmePath,
      recommendation:
        'Add code examples showing common test patterns used in this package',
    });
  }

  // Check for cross-package test documentation if package has cross-package dependencies
  const hasCrossDeps = hasCrossPackageDependencies(packagePath);
  const crossPackageTestDocs = extractCrossPackageTestDocs(
    readmePath,
    packageName
  );

  if (hasCrossDeps && crossPackageTestDocs.length === 0) {
    errors.push({
      type: 'MissingCrossPackageTestDocs',
      severity: 'warning',
      message: `Package '${packageName}' has cross-package dependencies but no cross-package test documentation`,
      location: readmePath,
      recommendation:
        'Add documentation explaining how to test functionality that spans multiple packages',
    });
  }

  return {
    packageName,
    hasTestingSection: testingSection.hasSection,
    hasTestPatternExamples: testPatternExamples.length > 0,
    hasCrossPackageTestDocs: crossPackageTestDocs.length > 0,
    testingSectionLocation: testingSection.location,
    testPatternExamples,
    crossPackageTestDocs,
    errors,
  };
}

/**
 * Get summary statistics for testing approach validation
 * @param result - Validation result
 * @returns Summary object with metrics
 */
export function getTestingApproachValidationSummary(
  result: TestingApproachValidationResult
): {
  hasTestingSection: boolean;
  testPatternExampleCount: number;
  crossPackageTestDocCount: number;
  completenessScore: number;
} {
  const hasTestingSection = result.hasTestingSection ? 1 : 0;
  const hasTestPatternExamples = result.hasTestPatternExamples ? 1 : 0;
  const hasCrossPackageTestDocs = result.hasCrossPackageTestDocs ? 1 : 0;

  // Calculate completeness score (0-100)
  // If package doesn't need cross-package docs, score is based on 2 criteria
  // If package needs cross-package docs, score is based on 3 criteria
  const needsCrossPackageDocs = result.errors.some(
    (e) => e.type === 'MissingCrossPackageTestDocs'
  );

  let completenessScore: number;
  if (needsCrossPackageDocs) {
    completenessScore =
      ((hasTestingSection + hasTestPatternExamples + hasCrossPackageTestDocs) /
        3) *
      100;
  } else {
    completenessScore =
      ((hasTestingSection + hasTestPatternExamples) / 2) * 100;
  }

  return {
    hasTestingSection: result.hasTestingSection,
    testPatternExampleCount: result.testPatternExamples.length,
    crossPackageTestDocCount: result.crossPackageTestDocs.length,
    completenessScore,
  };
}
