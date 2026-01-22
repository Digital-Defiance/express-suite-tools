/**
 * ECIES-specific analyzer for verifying ECIES package documentation and test coverage
 * Validates encryption modes, ID providers, streaming API, and cross-platform examples
 */

import * as fs from 'fs';
import * as path from 'path';
import { PackageDocumentation, ValidationError } from '../types';

/**
 * Encryption modes that should be documented in ECIES packages
 */
export enum EncryptionMode {
  Basic = 'Basic',
  WithLength = 'WithLength',
  Multiple = 'Multiple',
}

/**
 * ID providers that should be documented in ECIES packages
 */
export enum IdProvider {
  ObjectId = 'ObjectId',
  GUID = 'GUID',
  UUID = 'UUID',
  Custom = 'Custom',
}

/**
 * Result of ECIES-specific analysis
 */
export interface EciesAnalysisResult {
  packageName: string;
  encryptionModes: {
    documented: EncryptionMode[];
    missing: EncryptionMode[];
  };
  idProviders: {
    documented: IdProvider[];
    missing: IdProvider[];
  };
  streamingApiDocumented: boolean;
  crossPlatformExamplesExist: boolean;
  issues: ValidationError[];
}

/**
 * Test matrix entry for encryption mode and ID provider combination
 */
export interface TestMatrixEntry {
  mode: EncryptionMode;
  provider: IdProvider;
  tested: boolean;
}

/**
 * Result of test matrix analysis
 */
export interface TestMatrixAnalysisResult {
  packageName: string;
  matrix: TestMatrixEntry[];
  coverage: number; // Percentage of combinations tested (0-100)
  missingCombinations: Array<{ mode: EncryptionMode; provider: IdProvider }>;
}

/**
 * Analyze ECIES package for documentation completeness
 * @param packagePath - Path to the ECIES package directory
 * @param packageDoc - Package documentation analysis
 * @returns ECIES-specific analysis result
 */
export function analyzeEciesPackage(
  packagePath: string,
  packageDoc: PackageDocumentation
): EciesAnalysisResult {
  const readmePath = findReadme(packagePath);
  const readmeContent = readmePath ? fs.readFileSync(readmePath, 'utf-8') : '';

  // Check for encryption modes
  const documentedModes = findDocumentedEncryptionModes(readmeContent);
  const missingModes = Object.values(EncryptionMode).filter(
    (mode) => !documentedModes.includes(mode)
  );

  // Check for ID providers
  const documentedProviders = findDocumentedIdProviders(readmeContent);
  const missingProviders = Object.values(IdProvider).filter(
    (provider) => !documentedProviders.includes(provider)
  );

  // Check for streaming API documentation
  const streamingApiDocumented = checkStreamingApiDocumentation(readmeContent);

  // Check for cross-platform examples
  const crossPlatformExamplesExist = checkCrossPlatformExamples(readmeContent);

  // Generate issues
  const issues: ValidationError[] = [];

  if (missingModes.length > 0) {
    issues.push({
      type: 'missing-encryption-mode-documentation',
      severity: 'critical',
      message: `Missing documentation for encryption modes: ${missingModes.join(
        ', '
      )}`,
      location: readmePath || packagePath,
      recommendation: `Add documentation for all encryption modes (${Object.values(
        EncryptionMode
      ).join(', ')}) in the README`,
    });
  }

  if (missingProviders.length > 0) {
    issues.push({
      type: 'missing-id-provider-documentation',
      severity: 'critical',
      message: `Missing documentation for ID providers: ${missingProviders.join(
        ', '
      )}`,
      location: readmePath || packagePath,
      recommendation: `Add documentation for all ID providers (${Object.values(
        IdProvider
      ).join(', ')}) in the README`,
    });
  }

  if (!streamingApiDocumented) {
    issues.push({
      type: 'missing-streaming-api-documentation',
      severity: 'critical',
      message: 'Streaming encryption API is not documented',
      location: readmePath || packagePath,
      recommendation:
        'Add documentation for the streaming encryption API with examples',
    });
  }

  if (!crossPlatformExamplesExist) {
    issues.push({
      type: 'missing-cross-platform-examples',
      severity: 'warning',
      message: 'Cross-platform encryption/decryption examples are missing',
      location: readmePath || packagePath,
      recommendation:
        'Add examples showing encryption/decryption between ecies-lib and node-ecies-lib',
    });
  }

  return {
    packageName: packageDoc.packageName,
    encryptionModes: {
      documented: documentedModes,
      missing: missingModes,
    },
    idProviders: {
      documented: documentedProviders,
      missing: missingProviders,
    },
    streamingApiDocumented,
    crossPlatformExamplesExist,
    issues,
  };
}

/**
 * Analyze test coverage for encryption mode and ID provider combinations
 * @param packagePath - Path to the ECIES package directory
 * @returns Test matrix analysis result
 */
export function analyzeEciesTestMatrix(
  packagePath: string
): TestMatrixAnalysisResult {
  const packageName = getPackageName(packagePath);
  const testFiles = findTestFiles(packagePath);

  // Build matrix of all combinations
  const matrix: TestMatrixEntry[] = [];
  const modes = Object.values(EncryptionMode);
  const providers = Object.values(IdProvider);

  for (const mode of modes) {
    for (const provider of providers) {
      const tested = checkCombinationTested(testFiles, mode, provider);
      matrix.push({ mode, provider, tested });
    }
  }

  // Calculate coverage
  const testedCount = matrix.filter((entry) => entry.tested).length;
  const coverage = Math.round((testedCount / matrix.length) * 100);

  // Find missing combinations
  const missingCombinations = matrix
    .filter((entry) => !entry.tested)
    .map((entry) => ({ mode: entry.mode, provider: entry.provider }));

  return {
    packageName,
    matrix,
    coverage,
    missingCombinations,
  };
}

/**
 * Find documented encryption modes in README content
 * @param readmeContent - Content of the README file
 * @returns Array of documented encryption modes
 */
function findDocumentedEncryptionModes(
  readmeContent: string
): EncryptionMode[] {
  const documented: EncryptionMode[] = [];

  // Check for each mode in the content
  if (
    /\b(Basic|basic)\s+(mode|encryption|ECIES)/i.test(readmeContent) ||
    /mode.*Basic/i.test(readmeContent)
  ) {
    documented.push(EncryptionMode.Basic);
  }

  if (
    /\b(WithLength|withLength|with\s*length)\s+(mode|encryption|recipient)/i.test(readmeContent) ||
    /mode.*WithLength/i.test(readmeContent)
  ) {
    documented.push(EncryptionMode.WithLength);
  }

  if (
    /\b(Multiple|multiple)\s+(mode|encryption|recipient)/i.test(
      readmeContent
    ) ||
    /mode.*Multiple/i.test(readmeContent) ||
    /multi-recipient/i.test(readmeContent)
  ) {
    documented.push(EncryptionMode.Multiple);
  }

  return documented;
}

/**
 * Find documented ID providers in README content
 * @param readmeContent - Content of the README file
 * @returns Array of documented ID providers
 */
function findDocumentedIdProviders(readmeContent: string): IdProvider[] {
  const documented: IdProvider[] = [];

  // Check for each provider in the content
  if (
    /\b(ObjectId|ObjectIdProvider)\b/i.test(readmeContent) ||
    /MongoDB.*ID/i.test(readmeContent)
  ) {
    documented.push(IdProvider.ObjectId);
  }

  if (
    /\b(GUID|GuidV4Provider|Guid)\b/i.test(readmeContent) ||
    /globally unique identifier/i.test(readmeContent)
  ) {
    documented.push(IdProvider.GUID);
  }

  if (/\b(UUID|UuidProvider)\b/i.test(readmeContent)) {
    documented.push(IdProvider.UUID);
  }

  if (
    /\b(Custom|CustomIdProvider)\b/i.test(readmeContent) ||
    /custom.*ID.*provider/i.test(readmeContent)
  ) {
    documented.push(IdProvider.Custom);
  }

  return documented;
}

/**
 * Check if streaming API is documented
 * @param readmeContent - Content of the README file
 * @returns True if streaming API is documented
 */
function checkStreamingApiDocumentation(readmeContent: string): boolean {
  return (
    /streaming\s+(encryption|API|interface)/i.test(readmeContent) ||
    /EncryptionStream/i.test(readmeContent) ||
    /stream.*encrypt/i.test(readmeContent) ||
    /encrypt.*stream/i.test(readmeContent)
  );
}

/**
 * Check if cross-platform examples exist
 * @param readmeContent - Content of the README file
 * @returns True if cross-platform examples are present
 */
function checkCrossPlatformExamples(readmeContent: string): boolean {
  return (
    /cross-platform/i.test(readmeContent) ||
    /(ecies-lib.*node-ecies-lib|node-ecies-lib.*ecies-lib)/i.test(
      readmeContent
    ) ||
    /binary.*compatible/i.test(readmeContent)
  );
}

/**
 * Find the README file in a package directory
 * @param packagePath - Path to the package directory
 * @returns Path to README file or null if not found
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
 * Get package name from package.json
 * @param packagePath - Path to the package directory
 * @returns Package name
 */
function getPackageName(packagePath: string): string {
  const packageJsonPath = path.join(packagePath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return packageJson.name || path.basename(packagePath);
    } catch (_error) {
      return path.basename(packagePath);
    }
  }
  return path.basename(packagePath);
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
  // Read all test files and check for the combination
  for (const testFile of testFiles) {
    try {
      const content = fs.readFileSync(testFile, 'utf-8');

      // Check if both mode and provider are mentioned in the same file
      const modePattern = new RegExp(
        `\\b${mode}\\b|encrypt${mode}|${mode.toLowerCase()}Mode`,
        'i'
      );
      const providerPattern = new RegExp(
        `\\b${provider}\\b|${provider}Provider|${provider.toLowerCase()}Id`,
        'i'
      );

      if (modePattern.test(content) && providerPattern.test(content)) {
        return true;
      }
    } catch (_error) {
      // Skip files that can't be read
      continue;
    }
  }

  return false;
}

/**
 * Generate a report of missing test combinations
 * @param result - Test matrix analysis result
 * @returns Array of validation errors for missing combinations
 */
export function generateTestMatrixReport(
  result: TestMatrixAnalysisResult
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (result.missingCombinations.length > 0) {
    errors.push({
      type: 'incomplete-test-matrix',
      severity: 'critical',
      message: `Test matrix coverage is ${result.coverage}%. Missing ${result.missingCombinations.length} combinations.`,
      recommendation: `Add tests for the following mode × provider combinations: ${result.missingCombinations
        .map((c) => `${c.mode} × ${c.provider}`)
        .join(', ')}`,
    });
  }

  return errors;
}

/**
 * Check if a package is an ECIES package
 * @param packageName - Name of the package
 * @returns True if the package is an ECIES package
 */
export function isEciesPackage(packageName: string): boolean {
  return (
    packageName.includes('ecies') ||
    packageName.includes('ECIES') ||
    packageName === '@digitaldefiance/ecies-lib' ||
    packageName === '@digitaldefiance/node-ecies-lib'
  );
}
