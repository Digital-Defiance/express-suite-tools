/**
 * ECIES test matrix validator
 * Validates ECIES test coverage including:
 * - All mode × provider combinations
 * - Streaming encryption tests with large files
 * - Multi-recipient encryption tests
 * - Binary compatibility tests between ecies-lib and node-ecies-lib
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  EncryptionMode,
  IdProvider,
  TestMatrixEntry,
} from '../analyzers/ecies-analyzer';
import { ValidationError } from '../types';

/**
 * Result of ECIES test validation
 */
export interface EciesTestValidationResult {
  packageName: string;
  matrixCoverage: TestMatrixCoverage;
  streamingTests: StreamingTestResult;
  multiRecipientTests: MultiRecipientTestResult;
  binaryCompatibilityTests: BinaryCompatibilityTestResult;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Test matrix coverage information
 */
export interface TestMatrixCoverage {
  totalCombinations: number;
  testedCombinations: number;
  coverage: number; // Percentage (0-100)
  matrix: TestMatrixEntry[];
  missingCombinations: Array<{ mode: EncryptionMode; provider: IdProvider }>;
}

/**
 * Streaming test result
 */
export interface StreamingTestResult {
  hasStreamingTests: boolean;
  hasLargeFileTests: boolean;
  testFiles: string[];
}

/**
 * Multi-recipient test result
 */
export interface MultiRecipientTestResult {
  hasMultiRecipientTests: boolean;
  testFiles: string[];
}

/**
 * Binary compatibility test result
 */
export interface BinaryCompatibilityTestResult {
  hasBinaryCompatibilityTests: boolean;
  testFiles: string[];
  crossPackageTestsExist: boolean;
}

/**
 * Validate ECIES test coverage for a package
 * @param packagePath - Path to the ECIES package directory
 * @param packageName - Name of the package
 * @returns ECIES test validation result
 */
export function validateEciesTests(
  packagePath: string,
  packageName: string
): EciesTestValidationResult {
  const testFiles = findTestFiles(packagePath);

  // Validate test matrix coverage
  const matrixCoverage = validateTestMatrix(testFiles);

  // Validate streaming tests
  const streamingTests = validateStreamingTests(testFiles);

  // Validate multi-recipient tests
  const multiRecipientTests = validateMultiRecipientTests(testFiles);

  // Validate binary compatibility tests
  const binaryCompatibilityTests = validateBinaryCompatibilityTests(
    packagePath,
    testFiles
  );

  // Generate errors and warnings
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check matrix coverage
  if (matrixCoverage.coverage < 100) {
    errors.push({
      type: 'incomplete-ecies-test-matrix',
      severity: 'critical',
      message: `ECIES test matrix coverage is ${matrixCoverage.coverage}%. Missing ${matrixCoverage.missingCombinations.length} mode × provider combinations.`,
      location: packagePath,
      recommendation: `Add tests for: ${matrixCoverage.missingCombinations
        .map((c) => `${c.mode} × ${c.provider}`)
        .join(', ')}`,
    });
  }

  // Check streaming tests
  if (!streamingTests.hasStreamingTests) {
    errors.push({
      type: 'missing-streaming-tests',
      severity: 'critical',
      message: 'No streaming encryption tests found',
      location: packagePath,
      recommendation:
        'Add tests for streaming encryption API (EncryptionStream, DecryptionStream)',
    });
  }

  if (!streamingTests.hasLargeFileTests) {
    warnings.push({
      type: 'missing-large-file-tests',
      severity: 'warning',
      message: 'No tests for streaming encryption with large files found',
      location: packagePath,
      recommendation:
        'Add tests that verify streaming encryption works with files larger than memory buffer size',
    });
  }

  // Check multi-recipient tests
  if (!multiRecipientTests.hasMultiRecipientTests) {
    errors.push({
      type: 'missing-multi-recipient-tests',
      severity: 'critical',
      message: 'No multi-recipient encryption tests found',
      location: packagePath,
      recommendation:
        'Add tests for Multiple encryption mode with multiple recipients',
    });
  }

  // Check binary compatibility tests
  if (!binaryCompatibilityTests.hasBinaryCompatibilityTests) {
    errors.push({
      type: 'missing-binary-compatibility-tests',
      severity: 'critical',
      message: 'No binary compatibility tests found',
      location: packagePath,
      recommendation:
        'Add tests that verify encrypted data can be decrypted across ecies-lib and node-ecies-lib',
    });
  }

  return {
    packageName,
    matrixCoverage,
    streamingTests,
    multiRecipientTests,
    binaryCompatibilityTests,
    errors,
    warnings,
  };
}

/**
 * Validate test matrix coverage for all mode × provider combinations
 * @param testFiles - Array of test file paths
 * @returns Test matrix coverage information
 */
function validateTestMatrix(testFiles: string[]): TestMatrixCoverage {
  const modes = Object.values(EncryptionMode);
  const providers = Object.values(IdProvider);

  const matrix: TestMatrixEntry[] = [];
  const missingCombinations: Array<{
    mode: EncryptionMode;
    provider: IdProvider;
  }> = [];

  for (const mode of modes) {
    for (const provider of providers) {
      const tested = checkCombinationTested(testFiles, mode, provider);
      matrix.push({ mode, provider, tested });

      if (!tested) {
        missingCombinations.push({ mode, provider });
      }
    }
  }

  const totalCombinations = matrix.length;
  const testedCombinations = matrix.filter((entry) => entry.tested).length;
  const coverage = Math.round((testedCombinations / totalCombinations) * 100);

  return {
    totalCombinations,
    testedCombinations,
    coverage,
    matrix,
    missingCombinations,
  };
}

/**
 * Check if a specific encryption mode and ID provider combination is tested
 * @param testFiles - Array of test file paths
 * @param mode - Encryption mode
 * @param provider - ID provider
 * @returns True if the combination is tested
 */
function checkCombinationTested(
  testFiles: string[],
  mode: EncryptionMode,
  provider: IdProvider
): boolean {
  for (const testFile of testFiles) {
    try {
      const content = fs.readFileSync(testFile, 'utf-8');

      // Create patterns for mode and provider
      const modePatterns = [
        new RegExp(`\\b${mode}\\b`, 'i'),
        new RegExp(`encrypt${mode}`, 'i'),
        new RegExp(`${mode.toLowerCase()}Mode`, 'i'),
        new RegExp(`Mode\\.${mode}`, 'i'),
      ];

      const providerPatterns = [
        new RegExp(`\\b${provider}\\b`, 'i'),
        new RegExp(`${provider}Provider`, 'i'),
        new RegExp(`${provider.toLowerCase()}Id`, 'i'),
        new RegExp(`IdProvider\\.${provider}`, 'i'),
      ];

      // Check if both mode and provider are mentioned in the same file
      const hasMode = modePatterns.some((pattern) => pattern.test(content));
      const hasProvider = providerPatterns.some((pattern) =>
        pattern.test(content)
      );

      if (hasMode && hasProvider) {
        return true;
      }
    } catch (error) {
      // Skip files that can't be read
      continue;
    }
  }

  return false;
}

/**
 * Validate streaming encryption tests
 * @param testFiles - Array of test file paths
 * @returns Streaming test result
 */
function validateStreamingTests(testFiles: string[]): StreamingTestResult {
  const streamingTestFiles: string[] = [];
  let hasStreamingTests = false;
  let hasLargeFileTests = false;

  for (const testFile of testFiles) {
    try {
      const content = fs.readFileSync(testFile, 'utf-8');

      // Check for streaming-related keywords
      const streamingPatterns = [
        /streaming/i,
        /EncryptionStream/i,
        /DecryptionStream/i,
        /createEncryptionStream/i,
        /createDecryptionStream/i,
        /stream.*encrypt/i,
        /encrypt.*stream/i,
      ];

      const hasStreamingKeywords = streamingPatterns.some((pattern) =>
        pattern.test(content)
      );

      if (hasStreamingKeywords) {
        hasStreamingTests = true;
        streamingTestFiles.push(testFile);

        // Check for large file tests
        const largeFilePatterns = [
          /large.*file/i,
          /big.*file/i,
          /file.*size/i,
          /\d+\s*(MB|GB|megabyte|gigabyte)/i,
          /buffer.*size/i,
          /chunk/i,
        ];

        if (largeFilePatterns.some((pattern) => pattern.test(content))) {
          hasLargeFileTests = true;
        }
      }
    } catch (error) {
      // Skip files that can't be read
      continue;
    }
  }

  return {
    hasStreamingTests,
    hasLargeFileTests,
    testFiles: streamingTestFiles,
  };
}

/**
 * Validate multi-recipient encryption tests
 * @param testFiles - Array of test file paths
 * @returns Multi-recipient test result
 */
function validateMultiRecipientTests(
  testFiles: string[]
): MultiRecipientTestResult {
  const multiRecipientTestFiles: string[] = [];
  let hasMultiRecipientTests = false;

  for (const testFile of testFiles) {
    try {
      const content = fs.readFileSync(testFile, 'utf-8');

      // Check for multi-recipient keywords
      const multiRecipientPatterns = [
        /multi.*recipient/i,
        /multiple.*recipient/i,
        /recipients\s*\[/i,
        /recipient.*array/i,
        /Mode\.Multiple/i,
        /encryptMultiple/i,
      ];

      if (multiRecipientPatterns.some((pattern) => pattern.test(content))) {
        hasMultiRecipientTests = true;
        multiRecipientTestFiles.push(testFile);
      }
    } catch (error) {
      // Skip files that can't be read
      continue;
    }
  }

  return {
    hasMultiRecipientTests,
    testFiles: multiRecipientTestFiles,
  };
}

/**
 * Validate binary compatibility tests between ecies-lib and node-ecies-lib
 * @param packagePath - Path to the package directory
 * @param testFiles - Array of test file paths
 * @returns Binary compatibility test result
 */
function validateBinaryCompatibilityTests(
  packagePath: string,
  testFiles: string[]
): BinaryCompatibilityTestResult {
  const compatibilityTestFiles: string[] = [];
  let hasBinaryCompatibilityTests = false;
  let crossPackageTestsExist = false;

  for (const testFile of testFiles) {
    try {
      const content = fs.readFileSync(testFile, 'utf-8');

      // Check for binary compatibility keywords
      const compatibilityPatterns = [
        /binary.*compatib/i,
        /cross.*platform/i,
        /interop/i,
        /ecies-lib.*node-ecies-lib/i,
        /node-ecies-lib.*ecies-lib/i,
        /encrypt.*decrypt.*different/i,
        /compatibility.*test/i,
      ];

      if (compatibilityPatterns.some((pattern) => pattern.test(content))) {
        hasBinaryCompatibilityTests = true;
        compatibilityTestFiles.push(testFile);
      }

      // Check for cross-package imports
      const importRegex = /import\s+.*?\s+from\s+['"](@[^/]+\/[^'"]+)['"]/g;
      const matches = Array.from(content.matchAll(importRegex));
      const packages = new Set(matches.map((m) => m[1]));

      // Check if imports from both ecies-lib and node-ecies-lib
      const hasEciesLib = Array.from(packages).some((pkg) =>
        pkg.includes('ecies-lib')
      );
      const hasNodeEciesLib = Array.from(packages).some((pkg) =>
        pkg.includes('node-ecies-lib')
      );

      if (hasEciesLib && hasNodeEciesLib) {
        crossPackageTestsExist = true;
      }
    } catch (error) {
      // Skip files that can't be read
      continue;
    }
  }

  return {
    hasBinaryCompatibilityTests,
    testFiles: compatibilityTestFiles,
    crossPackageTestsExist,
  };
}

/**
 * Find all test files in a package
 * @param packagePath - Path to the package directory
 * @returns Array of test file paths
 */
function findTestFiles(packagePath: string): string[] {
  const testFiles: string[] = [];
  const testDirs = ['tests', 'test', '__tests__', 'src/__tests__'];

  for (const testDir of testDirs) {
    const testPath = path.join(packagePath, testDir);
    if (fs.existsSync(testPath)) {
      collectTestFiles(testPath, testFiles);
    }
  }

  return testFiles;
}

/**
 * Recursively collect test files from a directory
 * @param dir - Directory to search
 * @param testFiles - Array to collect test file paths
 */
function collectTestFiles(dir: string, testFiles: string[]): void {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        collectTestFiles(fullPath, testFiles);
      } else if (
        entry.isFile() &&
        /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(entry.name)
      ) {
        testFiles.push(fullPath);
      }
    }
  } catch (error) {
    // Skip directories that can't be read
  }
}

/**
 * Generate a comprehensive report of ECIES test validation
 * @param result - ECIES test validation result
 * @returns Formatted report string
 */
export function generateEciesTestReport(
  result: EciesTestValidationResult
): string {
  const lines: string[] = [];

  lines.push(`ECIES Test Validation Report: ${result.packageName}`);
  lines.push('='.repeat(60));
  lines.push('');

  // Matrix coverage
  lines.push('Test Matrix Coverage:');
  lines.push(
    `  Coverage: ${result.matrixCoverage.coverage}% (${result.matrixCoverage.testedCombinations}/${result.matrixCoverage.totalCombinations} combinations)`
  );

  if (result.matrixCoverage.missingCombinations.length > 0) {
    lines.push('  Missing combinations:');
    for (const combo of result.matrixCoverage.missingCombinations) {
      lines.push(`    - ${combo.mode} × ${combo.provider}`);
    }
  }
  lines.push('');

  // Streaming tests
  lines.push('Streaming Tests:');
  lines.push(
    `  Has streaming tests: ${
      result.streamingTests.hasStreamingTests ? 'Yes' : 'No'
    }`
  );
  lines.push(
    `  Has large file tests: ${
      result.streamingTests.hasLargeFileTests ? 'Yes' : 'No'
    }`
  );
  if (result.streamingTests.testFiles.length > 0) {
    lines.push(`  Test files: ${result.streamingTests.testFiles.length}`);
  }
  lines.push('');

  // Multi-recipient tests
  lines.push('Multi-Recipient Tests:');
  lines.push(
    `  Has multi-recipient tests: ${
      result.multiRecipientTests.hasMultiRecipientTests ? 'Yes' : 'No'
    }`
  );
  if (result.multiRecipientTests.testFiles.length > 0) {
    lines.push(`  Test files: ${result.multiRecipientTests.testFiles.length}`);
  }
  lines.push('');

  // Binary compatibility tests
  lines.push('Binary Compatibility Tests:');
  lines.push(
    `  Has compatibility tests: ${
      result.binaryCompatibilityTests.hasBinaryCompatibilityTests ? 'Yes' : 'No'
    }`
  );
  lines.push(
    `  Cross-package tests exist: ${
      result.binaryCompatibilityTests.crossPackageTestsExist ? 'Yes' : 'No'
    }`
  );
  if (result.binaryCompatibilityTests.testFiles.length > 0) {
    lines.push(
      `  Test files: ${result.binaryCompatibilityTests.testFiles.length}`
    );
  }
  lines.push('');

  // Errors and warnings
  if (result.errors.length > 0) {
    lines.push(`Errors: ${result.errors.length}`);
    for (const error of result.errors) {
      lines.push(`  - [${error.severity}] ${error.message}`);
      if (error.recommendation) {
        lines.push(`    Recommendation: ${error.recommendation}`);
      }
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push(`Warnings: ${result.warnings.length}`);
    for (const warning of result.warnings) {
      lines.push(`  - [${warning.severity}] ${warning.message}`);
      if (warning.recommendation) {
        lines.push(`    Recommendation: ${warning.recommendation}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
