/**
 * Test utilities documentation validator
 * Validates that test-utils exports are documented, have examples, and have validation tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { extractCodeExamples } from '../parsers/example-extractor';
import { parseReadmeContent } from '../parsers/markdown-parser';
import { parseTypeScriptExports } from '../parsers/typescript-parser';
import {
  CodeExample,
  DocumentedSymbol,
  ExportedSymbol,
  ValidationError,
} from '../types';

/**
 * Result of test-utils validation
 */
export interface TestUtilsValidationResult {
  packageName: string;
  exports: ExportedSymbol[];
  documentedSymbols: DocumentedSymbol[];
  examples: CodeExample[];
  undocumentedExports: ExportedSymbol[];
  exportsWithoutExamples: ExportedSymbol[];
  exportsWithoutValidationTests: ExportedSymbol[];
  errors: ValidationError[];
}

/**
 * Verify all test-utils exports are documented
 * @param exports - Array of exported symbols from test-utils
 * @param documentedSymbols - Array of documented symbols from README
 * @returns Array of undocumented exports
 */
export function findUndocumentedTestUtils(
  exports: ExportedSymbol[],
  documentedSymbols: DocumentedSymbol[]
): ExportedSymbol[] {
  const documentedNames = new Set(documentedSymbols.map((s) => s.name));

  return exports.filter((exp) => !documentedNames.has(exp.name));
}

/**
 * Verify test utility examples exist
 * @param exports - Array of exported symbols from test-utils
 * @param examples - Array of code examples from README
 * @returns Array of exports without examples
 */
export function findTestUtilsWithoutExamples(
  exports: ExportedSymbol[],
  examples: CodeExample[]
): ExportedSymbol[] {
  // Collect all symbols referenced in examples
  const exampleSymbols = new Set<string>();
  for (const example of examples) {
    for (const symbol of example.referencedSymbols) {
      exampleSymbols.add(symbol);
    }
  }

  // Find exports that are not referenced in any example
  return exports.filter((exp) => !exampleSymbols.has(exp.name));
}

/**
 * Verify test utilities have validation tests
 * @param exports - Array of exported symbols from test-utils
 * @param packagePath - Path to the test-utils package
 * @returns Array of exports without validation tests
 */
export function findTestUtilsWithoutValidationTests(
  exports: ExportedSymbol[],
  packagePath: string
): ExportedSymbol[] {
  const testsDir = path.join(packagePath, 'tests');
  const testDir = path.join(packagePath, 'test');

  // Check both 'tests' and 'test' directories
  const testDirs = [testsDir, testDir].filter((dir) => fs.existsSync(dir));

  if (testDirs.length === 0) {
    // No test directory means all exports are untested
    return [...exports];
  }

  // Find all test files
  const testFiles: string[] = [];
  for (const testDirPath of testDirs) {
    testFiles.push(...findTestFilesRecursive(testDirPath));
  }

  // Build a set of tested symbols
  const testedSymbols = new Set<string>();
  for (const testFile of testFiles) {
    try {
      const content = fs.readFileSync(testFile, 'utf-8');
      const imports = extractImportsFromTestFile(content);
      imports.forEach((imp) => testedSymbols.add(imp));
    } catch (error) {
      // Skip files that can't be read
      continue;
    }
  }

  // Find exports that are not tested
  return exports.filter((exp) => !testedSymbols.has(exp.name));
}

/**
 * Recursively find all test files in a directory
 * @param dirPath - Directory to search
 * @returns Array of test file paths
 */
function findTestFilesRecursive(dirPath: string): string[] {
  const testFiles: string[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        testFiles.push(...findTestFilesRecursive(fullPath));
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.test.ts') ||
          entry.name.endsWith('.test.tsx') ||
          entry.name.endsWith('.test.js') ||
          entry.name.endsWith('.test.jsx') ||
          entry.name.endsWith('.spec.ts') ||
          entry.name.endsWith('.spec.tsx') ||
          entry.name.endsWith('.spec.js') ||
          entry.name.endsWith('.spec.jsx'))
      ) {
        testFiles.push(fullPath);
      }
    }
  } catch (error) {
    return [];
  }

  return testFiles;
}

/**
 * Extract imported symbols from a test file
 * @param content - Test file content
 * @returns Array of imported symbol names
 */
function extractImportsFromTestFile(content: string): string[] {
  const imports = new Set<string>();

  // Pattern 1: Named imports - import { foo, bar } from 'module'
  const namedImportPattern = /import\s+{([^}]+)}\s+from/g;
  let match;

  while ((match = namedImportPattern.exec(content)) !== null) {
    const importList = match[1]
      .split(',')
      .map((s) => s.trim())
      .map((s) => {
        // Handle "as" aliases: import { foo as bar }
        const parts = s.split(/\s+as\s+/);
        return parts[0].trim();
      })
      .filter((s) => s.length > 0);

    importList.forEach((imp) => imports.add(imp));
  }

  // Pattern 2: Default imports - import Foo from 'module'
  const defaultImportPattern = /import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from/g;
  while ((match = defaultImportPattern.exec(content)) !== null) {
    imports.add(match[1]);
  }

  // Pattern 3: Namespace imports - import * as foo from 'module'
  const namespaceImportPattern =
    /import\s+\*\s+as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from/g;
  while ((match = namespaceImportPattern.exec(content)) !== null) {
    imports.add(match[1]);
  }

  return Array.from(imports);
}

/**
 * Validate test-utils package documentation and tests
 * @param packagePath - Path to the test-utils package
 * @returns Validation result with errors and metrics
 */
export function validateTestUtils(
  packagePath: string
): TestUtilsValidationResult {
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

  // Parse exports from TypeScript
  const exports = parseTypeScriptExports(packagePath);

  // Parse README
  const readmePath = path.join(packagePath, 'README.md');
  let documentedSymbols: DocumentedSymbol[] = [];
  let examples: CodeExample[] = [];

  if (fs.existsSync(readmePath)) {
    documentedSymbols = parseReadmeContent(readmePath);
    examples = extractCodeExamples(readmePath);
  } else {
    errors.push({
      type: 'MissingReadme',
      severity: 'critical',
      message: `README.md not found in ${packagePath}`,
      recommendation: 'Create a README.md file documenting the test utilities',
    });
  }

  // Find undocumented exports
  const undocumentedExports = findUndocumentedTestUtils(
    exports,
    documentedSymbols
  );

  for (const exp of undocumentedExports) {
    errors.push({
      type: 'UndocumentedTestUtil',
      severity: 'warning',
      message: `Test utility '${exp.name}' is not documented in README`,
      location: exp.sourceFile,
      recommendation: `Add documentation for '${exp.name}' in the README with usage examples`,
    });
  }

  // Find exports without examples
  const exportsWithoutExamples = findTestUtilsWithoutExamples(
    exports,
    examples
  );

  for (const exp of exportsWithoutExamples) {
    errors.push({
      type: 'MissingTestUtilExample',
      severity: 'warning',
      message: `Test utility '${exp.name}' does not have a usage example`,
      location: exp.sourceFile,
      recommendation: `Add a code example showing how to use '${exp.name}'`,
    });
  }

  // Find exports without validation tests
  const exportsWithoutValidationTests = findTestUtilsWithoutValidationTests(
    exports,
    packagePath
  );

  for (const exp of exportsWithoutValidationTests) {
    errors.push({
      type: 'MissingTestUtilValidation',
      severity: 'warning',
      message: `Test utility '${exp.name}' does not have validation tests`,
      location: exp.sourceFile,
      recommendation: `Add tests that validate '${exp.name}' works as documented`,
    });
  }

  return {
    packageName,
    exports,
    documentedSymbols,
    examples,
    undocumentedExports,
    exportsWithoutExamples,
    exportsWithoutValidationTests,
    errors,
  };
}

/**
 * Get summary statistics for test-utils validation
 * @param result - Validation result
 * @returns Summary object with percentages
 */
export function getTestUtilsValidationSummary(
  result: TestUtilsValidationResult
): {
  totalExports: number;
  documentedCount: number;
  documentationPercentage: number;
  examplesCount: number;
  examplesPercentage: number;
  validatedCount: number;
  validationPercentage: number;
} {
  const totalExports = result.exports.length;
  const documentedCount = totalExports - result.undocumentedExports.length;
  const examplesCount = totalExports - result.exportsWithoutExamples.length;
  const validatedCount =
    totalExports - result.exportsWithoutValidationTests.length;

  return {
    totalExports,
    documentedCount,
    documentationPercentage:
      totalExports > 0 ? (documentedCount / totalExports) * 100 : 0,
    examplesCount,
    examplesPercentage:
      totalExports > 0 ? (examplesCount / totalExports) * 100 : 0,
    validatedCount,
    validationPercentage:
      totalExports > 0 ? (validatedCount / totalExports) * 100 : 0,
  };
}
