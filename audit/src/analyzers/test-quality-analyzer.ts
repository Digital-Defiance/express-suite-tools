/**
 * Test quality analyzer for analyzing test patterns and quality
 * Identifies error handling tests, edge case tests, and correlates tests with exports
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { parseTypeScriptExports } from '../parsers/typescript-parser';
import { ExportedSymbol, TestQualityReport } from '../types';

/**
 * Pattern for identifying error handling tests
 */
interface ErrorTestPattern {
  testName: string;
  testFile: string;
  testedFunction: string;
  errorType?: string;
}

/**
 * Pattern for identifying edge case tests
 */
interface EdgeCaseTestPattern {
  testName: string;
  testFile: string;
  testedFunction: string;
  edgeCase: string;
}

/**
 * Mapping between tests and exports
 */
export interface TestExportCorrelation {
  exportName: string;
  exportType: string;
  testFiles: string[];
  hasErrorTests: boolean;
  hasEdgeCaseTests: boolean;
  testCount: number;
}

/**
 * Analyze test patterns in a package
 * @param packagePath - Path to the package directory
 * @returns Test quality report
 */
export function analyzeTestPatterns(packagePath: string): TestQualityReport {
  const testFiles = findTestFiles(packagePath);

  let totalTests = 0;
  let testsWithErrorHandling = 0;
  let testsWithEdgeCases = 0;
  let integrationTests = 0;
  let exampleTests = 0;

  for (const testFile of testFiles) {
    const analysis = analyzeTestFile(testFile);

    totalTests += analysis.totalTests;
    testsWithErrorHandling += analysis.errorTests;
    testsWithEdgeCases += analysis.edgeCaseTests;
    integrationTests += analysis.integrationTests;
    exampleTests += analysis.exampleTests;
  }

  return {
    totalTests,
    testsWithErrorHandling,
    testsWithEdgeCases,
    integrationTests,
    exampleTests,
  };
}

/**
 * Find tests that verify error conditions
 * @param packagePath - Path to the package directory
 * @returns Array of error test patterns
 */
export function findErrorTests(packagePath: string): ErrorTestPattern[] {
  const errorTests: ErrorTestPattern[] = [];
  const testFiles = findTestFiles(packagePath);

  for (const testFile of testFiles) {
    const fileErrorTests = extractErrorTestsFromFile(testFile);
    errorTests.push(...fileErrorTests);
  }

  return errorTests;
}

/**
 * Correlate tests with exports to map which exports are tested
 * @param packagePath - Path to the package directory
 * @returns Array of test-export correlations
 */
export function correlateTestsWithExports(
  packagePath: string
): TestExportCorrelation[] {
  const exports = parseTypeScriptExports(packagePath);
  const testFiles = findTestFiles(packagePath);

  const correlations: TestExportCorrelation[] = [];

  for (const exp of exports) {
    const correlation = correlateExportWithTests(exp, testFiles);
    correlations.push(correlation);
  }

  return correlations;
}

/**
 * Find all test files in a package
 */
function findTestFiles(packagePath: string): string[] {
  const testFiles: string[] = [];
  const testDirs = [
    path.join(packagePath, 'tests'),
    path.join(packagePath, 'test'),
    path.join(packagePath, '__tests__'),
    path.join(packagePath, 'src'),
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
 */
function findTestFilesRecursive(dir: string, testFiles: string[]): void {
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
}

/**
 * Analyze a single test file
 */
function analyzeTestFile(testFile: string): {
  totalTests: number;
  errorTests: number;
  edgeCaseTests: number;
  integrationTests: number;
  exampleTests: number;
} {
  try {
    const content = fs.readFileSync(testFile, 'utf-8');

    // Count total tests (it/test blocks)
    const testRegex = /\b(it|test)\s*\(/g;
    const totalTests = (content.match(testRegex) || []).length;

    // Count error handling tests
    const errorTests = countErrorTests(content);

    // Count edge case tests
    const edgeCaseTests = countEdgeCaseTests(content);

    // Count integration tests (tests that import from multiple packages)
    const integrationTests = isIntegrationTest(content, testFile) ? 1 : 0;

    // Count example tests (tests that reference examples)
    const exampleTests = isExampleTest(content) ? 1 : 0;

    return {
      totalTests,
      errorTests,
      edgeCaseTests,
      integrationTests,
      exampleTests,
    };
  } catch (error) {
    return {
      totalTests: 0,
      errorTests: 0,
      edgeCaseTests: 0,
      integrationTests: 0,
      exampleTests: 0,
    };
  }
}

/**
 * Count error handling tests in content
 */
function countErrorTests(content: string): number {
  let count = 0;

  // Pattern 1: Tests with "error" or "throw" in the name
  const errorTestNameRegex =
    /\b(it|test)\s*\(\s*['"].*?(error|throw|fail|invalid|reject).*?['"]/gi;
  count += (content.match(errorTestNameRegex) || []).length;

  // Pattern 2: Tests that use expect().toThrow()
  const toThrowRegex = /expect\s*\([^)]*\)\s*\.toThrow/g;
  count += (content.match(toThrowRegex) || []).length;

  // Pattern 3: Tests that use expect().rejects
  const rejectsRegex = /expect\s*\([^)]*\)\s*\.rejects/g;
  count += (content.match(rejectsRegex) || []).length;

  // Pattern 4: Tests with try-catch blocks
  const tryCatchRegex = /try\s*\{[\s\S]*?\}\s*catch/g;
  count += (content.match(tryCatchRegex) || []).length;

  return count;
}

/**
 * Count edge case tests in content
 */
function countEdgeCaseTests(content: string): number {
  let count = 0;

  // Pattern 1: Tests with edge case keywords in the name
  const edgeCaseKeywords = [
    'edge',
    'boundary',
    'empty',
    'null',
    'undefined',
    'zero',
    'negative',
    'maximum',
    'minimum',
    'large',
    'small',
  ];

  for (const keyword of edgeCaseKeywords) {
    const regex = new RegExp(
      `\\b(it|test)\\s*\\(\\s*['"].*?${keyword}.*?['"]`,
      'gi'
    );
    count += (content.match(regex) || []).length;
  }

  return count;
}

/**
 * Check if test file is an integration test
 */
function isIntegrationTest(content: string, testFile: string): boolean {
  // Check if file name contains "integration"
  if (testFile.toLowerCase().includes('integration')) {
    return true;
  }

  // Check if imports from multiple packages
  const importRegex = /import\s+.*?\s+from\s+['"](@[^/]+\/[^'"]+)['"]/g;
  const matches = content.matchAll(importRegex);
  const packages = new Set<string>();

  for (const match of matches) {
    packages.add(match[1]);
  }

  // If imports from 2+ different packages, it's likely an integration test
  return packages.size >= 2;
}

/**
 * Check if test file tests examples
 */
function isExampleTest(content: string): boolean {
  // Check if file name or content references examples
  const exampleKeywords = ['example', 'readme', 'documentation'];

  for (const keyword of exampleKeywords) {
    if (content.toLowerCase().includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract error tests from a file
 */
function extractErrorTestsFromFile(testFile: string): ErrorTestPattern[] {
  const errorTests: ErrorTestPattern[] = [];

  try {
    const content = fs.readFileSync(testFile, 'utf-8');

    // Parse the file with TypeScript
    const sourceFile = ts.createSourceFile(
      testFile,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    // Find describe blocks and it blocks
    function visit(node: ts.Node) {
      // Look for it/test calls
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === 'it' || node.expression.text === 'test')
      ) {
        const args = node.arguments;
        if (args.length >= 1 && ts.isStringLiteral(args[0])) {
          const testName = args[0].text;

          // Check if test name suggests error handling
          if (
            /error|throw|fail|invalid|reject/i.test(testName) ||
            hasErrorHandlingCode(node)
          ) {
            errorTests.push({
              testName,
              testFile,
              testedFunction: extractTestedFunction(node, content),
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  } catch (error) {
    // Ignore parse errors
  }

  return errorTests;
}

/**
 * Check if a node contains error handling code
 */
function hasErrorHandlingCode(node: ts.Node): boolean {
  let hasErrorCode = false;

  function visit(n: ts.Node) {
    // Check for toThrow, rejects, try-catch
    if (ts.isCallExpression(n)) {
      const text = n.getText();
      if (
        text.includes('toThrow') ||
        text.includes('rejects') ||
        text.includes('catch')
      ) {
        hasErrorCode = true;
      }
    }

    if (ts.isTryStatement(n)) {
      hasErrorCode = true;
    }

    if (!hasErrorCode) {
      ts.forEachChild(n, visit);
    }
  }

  visit(node);
  return hasErrorCode;
}

/**
 * Extract the function being tested from a test node
 */
function extractTestedFunction(node: ts.Node, content: string): string {
  // Try to find the function name from the test
  let functionName = 'unknown';

  // Look for describe blocks above this test
  const text = content.substring(0, node.getStart());
  const describeMatch = text.match(/describe\s*\(\s*['"]([^'"]+)['"]/g);

  if (describeMatch && describeMatch.length > 0) {
    const lastDescribe = describeMatch[describeMatch.length - 1];
    const nameMatch = lastDescribe.match(/['"]([^'"]+)['"]/);
    if (nameMatch) {
      functionName = nameMatch[1];
    }
  }

  return functionName;
}

/**
 * Correlate a single export with its tests
 */
function correlateExportWithTests(
  exp: ExportedSymbol,
  testFiles: string[]
): TestExportCorrelation {
  const testFilesForExport: string[] = [];
  let hasErrorTests = false;
  let hasEdgeCaseTests = false;
  let testCount = 0;

  for (const testFile of testFiles) {
    try {
      const content = fs.readFileSync(testFile, 'utf-8');

      // Check if this test file imports the export
      const importRegex = new RegExp(
        `import\\s+\\{[^}]*\\b${exp.name}\\b[^}]*\\}`,
        'g'
      );
      const defaultImportRegex = new RegExp(
        `import\\s+${exp.name}\\s+from`,
        'g'
      );

      if (importRegex.test(content) || defaultImportRegex.test(content)) {
        testFilesForExport.push(testFile);

        // Check for error tests
        const errorTestRegex = new RegExp(
          `(it|test)\\s*\\(\\s*['"].*?(${exp.name}|error|throw).*?['"]`,
          'gi'
        );
        if (errorTestRegex.test(content) || /toThrow|rejects/.test(content)) {
          hasErrorTests = true;
        }

        // Check for edge case tests
        const edgeCaseKeywords = [
          'edge',
          'boundary',
          'empty',
          'null',
          'undefined',
        ];
        for (const keyword of edgeCaseKeywords) {
          const regex = new RegExp(
            `(it|test)\\s*\\(\\s*['"].*?${keyword}.*?['"]`,
            'gi'
          );
          if (regex.test(content)) {
            hasEdgeCaseTests = true;
            break;
          }
        }

        // Count tests
        const testRegex = /\b(it|test)\s*\(/g;
        testCount += (content.match(testRegex) || []).length;
      }
    } catch (error) {
      // Ignore file read errors
    }
  }

  return {
    exportName: exp.name,
    exportType: exp.type,
    testFiles: testFilesForExport,
    hasErrorTests,
    hasEdgeCaseTests,
    testCount,
  };
}
