/**
 * Example validator for validating code examples in README files
 * Validates that examples have corresponding tests and are executable
 */

import * as fs from 'fs';
import * as path from 'path';
import { extractCodeExamples } from '../parsers/example-extractor';
import { CodeExample, TestFile, ValidationError } from '../types';

/**
 * Find test files that test the examples in a README
 * @param examples - Array of code examples from README
 * @param packagePath - Path to the package directory
 * @returns Array of test files that reference example symbols
 */
export function findTestsForExamples(
  examples: CodeExample[],
  packagePath: string
): TestFile[] {
  const testFiles: TestFile[] = [];
  const testsDir = path.join(packagePath, 'tests');
  const testDir = path.join(packagePath, 'test');

  // Check both 'tests' and 'test' directories
  const testDirs = [testsDir, testDir].filter((dir) => fs.existsSync(dir));

  if (testDirs.length === 0) {
    return [];
  }

  // Collect all symbols referenced in examples
  const exampleSymbols = new Set<string>();
  for (const example of examples) {
    for (const symbol of example.referencedSymbols) {
      exampleSymbols.add(symbol);
    }
  }

  // Search for test files that reference these symbols
  for (const testDirPath of testDirs) {
    const testFilePaths = findTestFiles(testDirPath);

    for (const testFilePath of testFilePaths) {
      try {
        const content = fs.readFileSync(testFilePath, 'utf-8');
        const imports = extractImportsFromTestFile(content);

        // Check if any imported symbols match example symbols
        const matchingSymbols = imports.filter((imp) =>
          exampleSymbols.has(imp)
        );

        if (matchingSymbols.length > 0) {
          testFiles.push({
            path: testFilePath,
            imports: matchingSymbols,
          });
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
  }

  return testFiles;
}

/**
 * Recursively find all test files in a directory
 * @param dirPath - Directory to search
 * @returns Array of test file paths
 */
function findTestFiles(dirPath: string): string[] {
  const testFiles: string[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively search subdirectories
        testFiles.push(...findTestFiles(fullPath));
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
    // Return empty array if directory can't be read
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
 * Validate that code examples can be executed without errors
 * This performs basic syntax validation for TypeScript/JavaScript examples
 * @param example - Code example to validate
 * @returns Validation result with any errors found
 */
export function validateExampleExecutability(
  example: CodeExample
): ValidationError | null {
  // Only validate TypeScript and JavaScript examples
  if (example.language !== 'typescript' && example.language !== 'javascript') {
    return null;
  }

  const code = example.code;

  // Check for common syntax errors
  const errors: string[] = [];

  // Check for unmatched braces
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push('Unmatched braces');
  }

  // Check for unmatched parentheses
  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push('Unmatched parentheses');
  }

  // Check for unmatched brackets
  const openBrackets = (code.match(/\[/g) || []).length;
  const closeBrackets = (code.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    errors.push('Unmatched brackets');
  }

  // Check for incomplete string literals
  const singleQuotes = (code.match(/(?<!\\)'/g) || []).length;
  const doubleQuotes = (code.match(/(?<!\\)"/g) || []).length;
  const backticks = (code.match(/(?<!\\)`/g) || []).length;

  if (singleQuotes % 2 !== 0) {
    errors.push('Unmatched single quotes');
  }
  if (doubleQuotes % 2 !== 0) {
    errors.push('Unmatched double quotes');
  }
  if (backticks % 2 !== 0) {
    errors.push('Unmatched backticks');
  }

  // Check for common incomplete patterns
  if (code.includes('import') && !code.includes('from')) {
    errors.push('Incomplete import statement');
  }

  if (errors.length > 0) {
    return {
      type: 'InvalidExampleSyntax',
      severity: 'warning',
      message: `Code example has syntax errors: ${errors.join(', ')}`,
      location: example.location,
      recommendation:
        'Fix the syntax errors in the code example or mark it as pseudo-code',
    };
  }

  return null;
}

/**
 * Cross-reference examples with test files
 * Updates the hasTest flag on examples based on whether tests exist
 * @param examples - Array of code examples
 * @param testFiles - Array of test files
 * @returns Updated examples with hasTest flag set
 */
export function crossReferenceExamplesWithTests(
  examples: CodeExample[],
  testFiles: TestFile[]
): CodeExample[] {
  // Build a set of all symbols that have tests
  const testedSymbols = new Set<string>();
  for (const testFile of testFiles) {
    for (const importedSymbol of testFile.imports) {
      testedSymbols.add(importedSymbol);
    }
  }

  // Update examples based on whether their symbols are tested
  return examples.map((example) => {
    const hasTest = example.referencedSymbols.some((symbol) =>
      testedSymbols.has(symbol)
    );

    return {
      ...example,
      hasTest,
    };
  });
}

/**
 * Validate all examples in a README file
 * @param readmePath - Path to the README file
 * @param packagePath - Path to the package directory
 * @returns Array of validation errors for examples without tests or with syntax errors
 */
export function validateExamples(
  readmePath: string,
  packagePath: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Extract examples from README
  let examples = extractCodeExamples(readmePath);

  if (examples.length === 0) {
    return errors;
  }

  // Find test files for examples
  const testFiles = findTestsForExamples(examples, packagePath);

  // Cross-reference examples with tests
  examples = crossReferenceExamplesWithTests(examples, testFiles);

  // Check each example
  for (const example of examples) {
    // Check for syntax errors
    const syntaxError = validateExampleExecutability(example);
    if (syntaxError) {
      errors.push(syntaxError);
    }

    // Check if example has tests (only for TypeScript/JavaScript)
    if (
      (example.language === 'typescript' ||
        example.language === 'javascript') &&
      !example.hasTest &&
      example.referencedSymbols.length > 0
    ) {
      errors.push({
        type: 'UntestedExample',
        severity: 'warning',
        message: `Code example references symbols (${example.referencedSymbols.join(
          ', '
        )}) that are not tested`,
        location: example.location,
        recommendation:
          'Add tests that validate this example works correctly, or ensure the referenced symbols are tested',
      });
    }
  }

  return errors;
}

/**
 * Get examples that don't have corresponding tests
 * @param examples - Array of code examples
 * @returns Array of examples without tests
 */
export function getUntestedExamples(examples: CodeExample[]): CodeExample[] {
  return examples.filter(
    (example) =>
      !example.hasTest &&
      (example.language === 'typescript' ||
        example.language === 'javascript') &&
      example.referencedSymbols.length > 0
  );
}

/**
 * Get examples that have syntax errors
 * @param examples - Array of code examples
 * @returns Array of examples with syntax errors
 */
export function getExamplesWithSyntaxErrors(
  examples: CodeExample[]
): CodeExample[] {
  return examples.filter((example) => {
    const error = validateExampleExecutability(example);
    return error !== null;
  });
}
