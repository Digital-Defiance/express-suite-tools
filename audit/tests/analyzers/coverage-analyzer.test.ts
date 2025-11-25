/**
 * Tests for coverage analyzer
 * **Feature: documentation-and-coverage-audit, Property 5: Test Coverage for Exports**
 * **Validates: Requirements 2.3**
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  checkCoverageThresholds,
  COVERAGE_THRESHOLDS,
  identifyUntestedExports,
  parseCoverageData,
} from '../../src/analyzers/coverage-analyzer';
import { CoverageReport } from '../../src/types';

describe('Coverage Analyzer', () => {
  describe('parseCoverageData', () => {
    it('should parse raw coverage data correctly', () => {
      const rawData = {
        total: {
          statements: { total: 100, covered: 95, pct: 95 },
          branches: { total: 50, covered: 45, pct: 90 },
          functions: { total: 20, covered: 19, pct: 95 },
          lines: { total: 100, covered: 95, pct: 95 },
        },
        'src/index.ts': {
          statements: { total: 50, covered: 48, pct: 96 },
          branches: { total: 25, covered: 23, pct: 92 },
          functions: { total: 10, covered: 10, pct: 100 },
          lines: { total: 50, covered: 48, pct: 96 },
        },
      };

      const result = parseCoverageData(rawData, 'test-package');

      expect(result.packageName).toBe('test-package');
      expect(result.statements.percentage).toBe(95);
      expect(result.statements.meetsThreshold).toBe(true);
      expect(result.branches.percentage).toBe(90);
      expect(result.branches.meetsThreshold).toBe(true);
      expect(result.functions.percentage).toBe(95);
      expect(result.functions.meetsThreshold).toBe(true);
      expect(result.lines.percentage).toBe(95);
      expect(result.lines.meetsThreshold).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('src/index.ts');
    });

    it('should mark metrics as not meeting threshold when below', () => {
      const rawData = {
        total: {
          statements: { total: 100, covered: 80, pct: 80 },
          branches: { total: 50, covered: 40, pct: 80 },
          functions: { total: 20, covered: 16, pct: 80 },
          lines: { total: 100, covered: 80, pct: 80 },
        },
      };

      const result = parseCoverageData(rawData, 'test-package');

      expect(result.statements.meetsThreshold).toBe(false); // 80 < 90
      expect(result.branches.meetsThreshold).toBe(false); // 80 < 85
      expect(result.functions.meetsThreshold).toBe(false); // 80 < 90
      expect(result.lines.meetsThreshold).toBe(false); // 80 < 90
    });

    it('should handle empty coverage data', () => {
      const rawData = {
        total: {
          statements: { total: 0, covered: 0, pct: 0 },
          branches: { total: 0, covered: 0, pct: 0 },
          functions: { total: 0, covered: 0, pct: 0 },
          lines: { total: 0, covered: 0, pct: 0 },
        },
      };

      const result = parseCoverageData(rawData, 'test-package');

      expect(result.statements.total).toBe(0);
      expect(result.statements.covered).toBe(0);
      expect(result.statements.percentage).toBe(0);
    });
  });

  describe('checkCoverageThresholds', () => {
    it('should return true when all thresholds are met', () => {
      const coverageReport: CoverageReport = {
        packageName: 'test',
        statements: {
          total: 100,
          covered: 95,
          percentage: 95,
          meetsThreshold: true,
        },
        branches: {
          total: 50,
          covered: 45,
          percentage: 90,
          meetsThreshold: true,
        },
        functions: {
          total: 20,
          covered: 19,
          percentage: 95,
          meetsThreshold: true,
        },
        lines: {
          total: 100,
          covered: 95,
          percentage: 95,
          meetsThreshold: true,
        },
        files: [],
        untestedExports: [],
      };

      const result = checkCoverageThresholds(coverageReport);

      expect(result.statements).toBe(true);
      expect(result.branches).toBe(true);
      expect(result.functions).toBe(true);
      expect(result.lines).toBe(true);
      expect(result.allMet).toBe(true);
    });

    it('should return false when any threshold is not met', () => {
      const coverageReport: CoverageReport = {
        packageName: 'test',
        statements: {
          total: 100,
          covered: 80,
          percentage: 80,
          meetsThreshold: false,
        },
        branches: {
          total: 50,
          covered: 45,
          percentage: 90,
          meetsThreshold: true,
        },
        functions: {
          total: 20,
          covered: 19,
          percentage: 95,
          meetsThreshold: true,
        },
        lines: {
          total: 100,
          covered: 95,
          percentage: 95,
          meetsThreshold: true,
        },
        files: [],
        untestedExports: [],
      };

      const result = checkCoverageThresholds(coverageReport);

      expect(result.statements).toBe(false);
      expect(result.allMet).toBe(false);
    });
  });

  describe('identifyUntestedExports', () => {
    it('should identify exports without tests', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const srcDir = path.join(tempDir, 'src');
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(srcDir);
      fs.mkdirSync(testsDir);

      try {
        // Create source file with exports
        fs.writeFileSync(
          path.join(srcDir, 'index.ts'),
          `
export function testedFunction(): void {}
export function untestedFunction(): void {}
export class TestedClass {}
export class UntestedClass {}
          `.trim()
        );

        // Create test file that only tests some exports
        fs.writeFileSync(
          path.join(testsDir, 'index.test.ts'),
          `
import { testedFunction, TestedClass } from '../src/index';

describe('testedFunction', () => {
  it('should work', () => {
    testedFunction();
  });
});

describe('TestedClass', () => {
  it('should work', () => {
    new TestedClass();
  });
});
          `.trim()
        );

        const coverageReport: CoverageReport = {
          packageName: 'test',
          statements: {
            total: 100,
            covered: 50,
            percentage: 50,
            meetsThreshold: false,
          },
          branches: {
            total: 50,
            covered: 25,
            percentage: 50,
            meetsThreshold: false,
          },
          functions: {
            total: 20,
            covered: 10,
            percentage: 50,
            meetsThreshold: false,
          },
          lines: {
            total: 100,
            covered: 50,
            percentage: 50,
            meetsThreshold: false,
          },
          files: [],
          untestedExports: [],
        };

        const result = identifyUntestedExports(tempDir, coverageReport);

        // Should find untestedFunction and UntestedClass
        expect(result.length).toBeGreaterThanOrEqual(2);

        const untestedNames = result.map((u) => u.symbol.name);
        expect(untestedNames).toContain('untestedFunction');
        expect(untestedNames).toContain('UntestedClass');
        expect(untestedNames).not.toContain('testedFunction');
        expect(untestedNames).not.toContain('TestedClass');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should handle package with no tests', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);

      try {
        // Create source file with exports
        fs.writeFileSync(
          path.join(srcDir, 'index.ts'),
          'export function myFunction(): void {}'
        );

        const coverageReport: CoverageReport = {
          packageName: 'test',
          statements: {
            total: 0,
            covered: 0,
            percentage: 0,
            meetsThreshold: false,
          },
          branches: {
            total: 0,
            covered: 0,
            percentage: 0,
            meetsThreshold: false,
          },
          functions: {
            total: 0,
            covered: 0,
            percentage: 0,
            meetsThreshold: false,
          },
          lines: { total: 0, covered: 0, percentage: 0, meetsThreshold: false },
          files: [],
          untestedExports: [],
        };

        const result = identifyUntestedExports(tempDir, coverageReport);

        // All exports should be untested
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].symbol.name).toBe('myFunction');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 5: Test Coverage for Exports
     * For any exported function or class, there should exist at least one test file
     * that imports and tests it.
     *
     * This property test verifies that the analyzer correctly identifies exports
     * that are not imported by any test files.
     */
    it('should correctly identify untested exports', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/),
              type: fc.constantFrom('function', 'class'),
              isTested: fc.boolean(),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (exports) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'audit-test-')
            );
            const srcDir = path.join(tempDir, 'src');
            const testsDir = path.join(tempDir, 'tests');
            fs.mkdirSync(srcDir);
            fs.mkdirSync(testsDir);

            try {
              // Create source file with all exports
              const sourceContent = exports
                .map((e) => {
                  if (e.type === 'function') {
                    return `export function ${e.name}(): void {}`;
                  } else {
                    return `export class ${e.name} {}`;
                  }
                })
                .join('\n');

              fs.writeFileSync(path.join(srcDir, 'index.ts'), sourceContent);

              // Create test file that imports only tested exports
              const testedExports = exports.filter((e) => e.isTested);
              if (testedExports.length > 0) {
                const importList = testedExports.map((e) => e.name).join(', ');
                const testContent = `
import { ${importList} } from '../src/index';

${testedExports
  .map(
    (e) => `
describe('${e.name}', () => {
  it('should work', () => {
    ${e.type === 'function' ? `${e.name}();` : `new ${e.name}();`}
  });
});
`
  )
  .join('\n')}
                `.trim();

                fs.writeFileSync(
                  path.join(testsDir, 'index.test.ts'),
                  testContent
                );
              }

              // Run analysis
              const coverageReport: CoverageReport = {
                packageName: 'test',
                statements: {
                  total: 100,
                  covered: 50,
                  percentage: 50,
                  meetsThreshold: false,
                },
                branches: {
                  total: 50,
                  covered: 25,
                  percentage: 50,
                  meetsThreshold: false,
                },
                functions: {
                  total: 20,
                  covered: 10,
                  percentage: 50,
                  meetsThreshold: false,
                },
                lines: {
                  total: 100,
                  covered: 50,
                  percentage: 50,
                  meetsThreshold: false,
                },
                files: [],
                untestedExports: [],
              };

              const untestedExports = identifyUntestedExports(
                tempDir,
                coverageReport
              );

              // Count expected untested exports
              const expectedUntested = exports.filter((e) => !e.isTested);

              // Verify the count matches
              expect(untestedExports.length).toBe(expectedUntested.length);

              // Verify all untested exports are identified
              const untestedNames = new Set(
                untestedExports.map((u) => u.symbol.name)
              );
              const expectedNames = new Set(
                expectedUntested.map((e) => e.name)
              );

              expect(untestedNames).toEqual(expectedNames);

              // Verify tested exports are not in untested list
              for (const tested of testedExports) {
                expect(untestedNames.has(tested.name)).toBe(false);
              }
            } finally {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Coverage percentages should be between 0 and 100
     */
    it('should calculate coverage percentages within valid range', () => {
      fc.assert(
        fc.property(
          fc.record({
            statements: fc.record({
              total: fc.integer({ min: 0, max: 1000 }),
              covered: fc.integer({ min: 0, max: 1000 }),
            }),
            branches: fc.record({
              total: fc.integer({ min: 0, max: 1000 }),
              covered: fc.integer({ min: 0, max: 1000 }),
            }),
            functions: fc.record({
              total: fc.integer({ min: 0, max: 1000 }),
              covered: fc.integer({ min: 0, max: 1000 }),
            }),
            lines: fc.record({
              total: fc.integer({ min: 0, max: 1000 }),
              covered: fc.integer({ min: 0, max: 1000 }),
            }),
          }),
          (data) => {
            // Ensure covered <= total
            const statements = {
              total: data.statements.total,
              covered: Math.min(data.statements.covered, data.statements.total),
              pct:
                data.statements.total === 0
                  ? 0
                  : Math.round(
                      (Math.min(
                        data.statements.covered,
                        data.statements.total
                      ) /
                        data.statements.total) *
                        100
                    ),
            };

            const branches = {
              total: data.branches.total,
              covered: Math.min(data.branches.covered, data.branches.total),
              pct:
                data.branches.total === 0
                  ? 0
                  : Math.round(
                      (Math.min(data.branches.covered, data.branches.total) /
                        data.branches.total) *
                        100
                    ),
            };

            const functions = {
              total: data.functions.total,
              covered: Math.min(data.functions.covered, data.functions.total),
              pct:
                data.functions.total === 0
                  ? 0
                  : Math.round(
                      (Math.min(data.functions.covered, data.functions.total) /
                        data.functions.total) *
                        100
                    ),
            };

            const lines = {
              total: data.lines.total,
              covered: Math.min(data.lines.covered, data.lines.total),
              pct:
                data.lines.total === 0
                  ? 0
                  : Math.round(
                      (Math.min(data.lines.covered, data.lines.total) /
                        data.lines.total) *
                        100
                    ),
            };

            const rawData = {
              total: { statements, branches, functions, lines },
            };

            const result = parseCoverageData(rawData, 'test-package');

            // All percentages should be between 0 and 100
            expect(result.statements.percentage).toBeGreaterThanOrEqual(0);
            expect(result.statements.percentage).toBeLessThanOrEqual(100);
            expect(result.branches.percentage).toBeGreaterThanOrEqual(0);
            expect(result.branches.percentage).toBeLessThanOrEqual(100);
            expect(result.functions.percentage).toBeGreaterThanOrEqual(0);
            expect(result.functions.percentage).toBeLessThanOrEqual(100);
            expect(result.lines.percentage).toBeGreaterThanOrEqual(0);
            expect(result.lines.percentage).toBeLessThanOrEqual(100);

            // Covered should never exceed total
            expect(result.statements.covered).toBeLessThanOrEqual(
              result.statements.total
            );
            expect(result.branches.covered).toBeLessThanOrEqual(
              result.branches.total
            );
            expect(result.functions.covered).toBeLessThanOrEqual(
              result.functions.total
            );
            expect(result.lines.covered).toBeLessThanOrEqual(
              result.lines.total
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Threshold checking should be consistent
     */
    it('should consistently check thresholds', () => {
      fc.assert(
        fc.property(
          fc.record({
            statements: fc.integer({ min: 0, max: 100 }),
            branches: fc.integer({ min: 0, max: 100 }),
            functions: fc.integer({ min: 0, max: 100 }),
            lines: fc.integer({ min: 0, max: 100 }),
          }),
          (percentages) => {
            const coverageReport: CoverageReport = {
              packageName: 'test',
              statements: {
                total: 100,
                covered: percentages.statements,
                percentage: percentages.statements,
                meetsThreshold:
                  percentages.statements >= COVERAGE_THRESHOLDS.statements,
              },
              branches: {
                total: 100,
                covered: percentages.branches,
                percentage: percentages.branches,
                meetsThreshold:
                  percentages.branches >= COVERAGE_THRESHOLDS.branches,
              },
              functions: {
                total: 100,
                covered: percentages.functions,
                percentage: percentages.functions,
                meetsThreshold:
                  percentages.functions >= COVERAGE_THRESHOLDS.functions,
              },
              lines: {
                total: 100,
                covered: percentages.lines,
                percentage: percentages.lines,
                meetsThreshold: percentages.lines >= COVERAGE_THRESHOLDS.lines,
              },
              files: [],
              untestedExports: [],
            };

            const result = checkCoverageThresholds(coverageReport);

            // Verify threshold checks match the meetsThreshold flags
            expect(result.statements).toBe(
              coverageReport.statements.meetsThreshold
            );
            expect(result.branches).toBe(
              coverageReport.branches.meetsThreshold
            );
            expect(result.functions).toBe(
              coverageReport.functions.meetsThreshold
            );
            expect(result.lines).toBe(coverageReport.lines.meetsThreshold);

            // Verify allMet is true only if all thresholds are met
            const expectedAllMet =
              result.statements &&
              result.branches &&
              result.functions &&
              result.lines;
            expect(result.allMet).toBe(expectedAllMet);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Untested exports should be a subset of all exports
     */
    it('should ensure untested exports are subset of all exports', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/),
              type: fc.constantFrom('function', 'class'),
              isTested: fc.boolean(),
            }),
            { minLength: 1, maxLength: 8 }
          ),
          (exports) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'audit-test-')
            );
            const srcDir = path.join(tempDir, 'src');
            const testsDir = path.join(tempDir, 'tests');
            fs.mkdirSync(srcDir);
            fs.mkdirSync(testsDir);

            try {
              // Create source file
              const sourceContent = exports
                .map((e) =>
                  e.type === 'function'
                    ? `export function ${e.name}(): void {}`
                    : `export class ${e.name} {}`
                )
                .join('\n');

              fs.writeFileSync(path.join(srcDir, 'index.ts'), sourceContent);

              // Create test file for tested exports
              const testedExports = exports.filter((e) => e.isTested);
              if (testedExports.length > 0) {
                const importList = testedExports.map((e) => e.name).join(', ');
                fs.writeFileSync(
                  path.join(testsDir, 'index.test.ts'),
                  `import { ${importList} } from '../src/index';`
                );
              }

              const coverageReport: CoverageReport = {
                packageName: 'test',
                statements: {
                  total: 100,
                  covered: 50,
                  percentage: 50,
                  meetsThreshold: false,
                },
                branches: {
                  total: 50,
                  covered: 25,
                  percentage: 50,
                  meetsThreshold: false,
                },
                functions: {
                  total: 20,
                  covered: 10,
                  percentage: 50,
                  meetsThreshold: false,
                },
                lines: {
                  total: 100,
                  covered: 50,
                  percentage: 50,
                  meetsThreshold: false,
                },
                files: [],
                untestedExports: [],
              };

              const untestedExports = identifyUntestedExports(
                tempDir,
                coverageReport
              );

              // All untested export names should be in the original exports
              const allExportNames = new Set(exports.map((e) => e.name));
              for (const untested of untestedExports) {
                expect(allExportNames.has(untested.symbol.name)).toBe(true);
              }

              // Untested exports should not exceed total exports
              expect(untestedExports.length).toBeLessThanOrEqual(
                exports.length
              );
            } finally {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
