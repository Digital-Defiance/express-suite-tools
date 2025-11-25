/**
 * Coverage analyzer for analyzing test coverage
 * Executes Jest with coverage flags and analyzes the results
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { parseTypeScriptExports } from '../parsers/typescript-parser';
import {
  CoverageMetric,
  CoverageReport,
  FileCoverage,
  UntestedExport,
} from '../types';

/**
 * Coverage thresholds as defined in requirements
 */
export const COVERAGE_THRESHOLDS = {
  statements: 90,
  branches: 85,
  functions: 90,
  lines: 90,
};

/**
 * Raw coverage data from Jest/Istanbul
 */
interface RawCoverageData {
  total: {
    statements: { total: number; covered: number; pct: number };
    branches: { total: number; covered: number; pct: number };
    functions: { total: number; covered: number; pct: number };
    lines: { total: number; covered: number; pct: number };
  };
  [filePath: string]: {
    statements: { total: number; covered: number; pct: number };
    branches: { total: number; covered: number; pct: number };
    functions: { total: number; covered: number; pct: number };
    lines: { total: number; covered: number; pct: number };
    statementMap?: Record<string, unknown>;
    fnMap?: Record<string, { name: string; line: number }>;
    branchMap?: Record<string, unknown>;
  };
}

/**
 * Run Jest with coverage flags and return coverage data
 * @param packagePath - Path to the package directory
 * @returns Raw coverage data from Jest
 */
export function runJestCoverage(packagePath: string): RawCoverageData {
  const coverageDir = path.join(packagePath, 'coverage');
  const coverageJsonPath = path.join(coverageDir, 'coverage-summary.json');

  try {
    // Run Jest with coverage
    const jestCommand = `cd "${packagePath}" && npx jest --coverage --coverageReporters=json-summary --silent`;
    execSync(jestCommand, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    // Read coverage data
    if (fs.existsSync(coverageJsonPath)) {
      const coverageData = JSON.parse(
        fs.readFileSync(coverageJsonPath, 'utf-8')
      );
      return coverageData;
    }

    // If no coverage file, return empty coverage
    return createEmptyCoverageData();
  } catch (error) {
    // If Jest fails or no tests exist, return empty coverage
    console.warn(
      `Warning: Could not run coverage for ${packagePath}: ${error}`
    );
    return createEmptyCoverageData();
  }
}

/**
 * Create empty coverage data structure
 * @returns Empty coverage data
 */
function createEmptyCoverageData(): RawCoverageData {
  return {
    total: {
      statements: { total: 0, covered: 0, pct: 0 },
      branches: { total: 0, covered: 0, pct: 0 },
      functions: { total: 0, covered: 0, pct: 0 },
      lines: { total: 0, covered: 0, pct: 0 },
    },
  };
}

/**
 * Parse raw coverage data into structured coverage report
 * @param rawData - Raw coverage data from Jest
 * @param packageName - Name of the package
 * @returns Structured coverage report
 */
export function parseCoverageData(
  rawData: RawCoverageData,
  packageName: string
): CoverageReport {
  const total = rawData.total;

  // Parse file-level coverage
  const files: FileCoverage[] = [];
  for (const [filePath, fileData] of Object.entries(rawData)) {
    if (filePath === 'total') continue;

    files.push({
      path: filePath,
      statements: createMetric(
        fileData.statements,
        COVERAGE_THRESHOLDS.statements
      ),
      branches: createMetric(fileData.branches, COVERAGE_THRESHOLDS.branches),
      functions: createMetric(
        fileData.functions,
        COVERAGE_THRESHOLDS.functions
      ),
      lines: createMetric(fileData.lines, COVERAGE_THRESHOLDS.lines),
    });
  }

  return {
    packageName,
    statements: createMetric(total.statements, COVERAGE_THRESHOLDS.statements),
    branches: createMetric(total.branches, COVERAGE_THRESHOLDS.branches),
    functions: createMetric(total.functions, COVERAGE_THRESHOLDS.functions),
    lines: createMetric(total.lines, COVERAGE_THRESHOLDS.lines),
    files,
    untestedExports: [], // Will be populated by identifyUntestedExports
  };
}

/**
 * Create a coverage metric from raw data
 * @param data - Raw metric data
 * @param threshold - Threshold percentage
 * @returns Coverage metric
 */
function createMetric(
  data: { total: number; covered: number; pct: number },
  threshold: number
): CoverageMetric {
  return {
    total: data.total,
    covered: data.covered,
    percentage: data.pct,
    meetsThreshold: data.pct >= threshold,
  };
}

/**
 * Identify exports that are not tested
 * @param packagePath - Path to the package directory
 * @param coverageReport - Coverage report for the package
 * @returns Array of untested exports
 */
export function identifyUntestedExports(
  packagePath: string,
  coverageReport: CoverageReport
): UntestedExport[] {
  const untestedExports: UntestedExport[] = [];

  // Get all exports from the package
  const exports = parseTypeScriptExports(packagePath);

  // Get test files
  const testFiles = findTestFiles(packagePath);
  const testedSymbols = extractTestedSymbols(testFiles);

  // Check each export
  for (const exp of exports) {
    if (!testedSymbols.has(exp.name)) {
      untestedExports.push({
        symbol: exp,
        reason: 'No test file imports or tests this export',
      });
    }
  }

  return untestedExports;
}

/**
 * Find all test files in a package
 * @param packagePath - Path to the package directory
 * @returns Array of test file paths
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
 * @param dir - Directory to search
 * @param testFiles - Array to accumulate test files
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
 * Extract symbols that are tested from test files
 * @param testFiles - Array of test file paths
 * @returns Set of tested symbol names
 */
function extractTestedSymbols(testFiles: string[]): Set<string> {
  const testedSymbols = new Set<string>();

  for (const testFile of testFiles) {
    try {
      const content = fs.readFileSync(testFile, 'utf-8');

      // Extract imports from test files
      // Match: import { symbol1, symbol2 } from '...'
      const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"]/g;
      let match;

      while ((match = importRegex.exec(content)) !== null) {
        const imports = match[1].split(',').map((s) => s.trim());
        for (const imp of imports) {
          // Handle aliased imports: "symbol as alias"
          const symbolName = imp.split(/\s+as\s+/)[0].trim();
          testedSymbols.add(symbolName);
        }
      }

      // Also match default imports: import symbol from '...'
      const defaultImportRegex =
        /import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s+['"][^'"]+['"]/g;
      while ((match = defaultImportRegex.exec(content)) !== null) {
        testedSymbols.add(match[1]);
      }

      // Match describe/it blocks that reference symbols
      const describeRegex = /describe\s*\(\s*['"]([^'"]+)['"]/g;
      while ((match = describeRegex.exec(content)) !== null) {
        // Extract potential symbol names from describe blocks
        const description = match[1];
        const symbolMatch = description.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (symbolMatch) {
          testedSymbols.add(symbolMatch[1]);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read test file ${testFile}: ${error}`);
    }
  }

  return testedSymbols;
}

/**
 * Check if coverage metrics meet minimum thresholds
 * @param coverageReport - Coverage report to check
 * @returns Object indicating which thresholds are met
 */
export function checkCoverageThresholds(coverageReport: CoverageReport): {
  statements: boolean;
  branches: boolean;
  functions: boolean;
  lines: boolean;
  allMet: boolean;
} {
  const statements = coverageReport.statements.meetsThreshold;
  const branches = coverageReport.branches.meetsThreshold;
  const functions = coverageReport.functions.meetsThreshold;
  const lines = coverageReport.lines.meetsThreshold;

  return {
    statements,
    branches,
    functions,
    lines,
    allMet: statements && branches && functions && lines,
  };
}

/**
 * Run complete coverage analysis for a package
 * @param packagePath - Path to the package directory
 * @returns Coverage report with untested exports
 */
export function runCoverageAnalysis(packagePath: string): CoverageReport {
  // Get package name
  const packageJsonPath = path.join(packagePath, 'package.json');
  let packageName = path.basename(packagePath);

  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      packageName = packageJson.name || packageName;
    } catch (error) {
      // Use directory name as fallback
    }
  }

  // Run coverage
  const rawCoverage = runJestCoverage(packagePath);

  // Parse coverage data
  const coverageReport = parseCoverageData(rawCoverage, packageName);

  // Identify untested exports
  const untestedExports = identifyUntestedExports(packagePath, coverageReport);
  coverageReport.untestedExports = untestedExports;

  return coverageReport;
}
