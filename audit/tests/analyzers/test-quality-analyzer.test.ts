/**
 * Tests for test quality analyzer
 * **Feature: documentation-and-coverage-audit, Property 6: Error Condition Testing**
 * **Validates: Requirements 2.4**
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  analyzeTestPatterns,
  correlateTestsWithExports,
  findErrorTests,
} from '../../src/analyzers/test-quality-analyzer';
import { PROPERTY_TEST_CONFIG } from '../test-config';

describe('Test Quality Analyzer', () => {
  describe('analyzeTestPatterns', () => {
    it('should analyze test patterns in a package', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(testsDir);

      try {
        // Create a test file with various patterns
        fs.writeFileSync(
          path.join(testsDir, 'example.test.ts'),
          `
import { myFunction } from '../src/index';

describe('myFunction', () => {
  it('should work correctly', () => {
    expect(myFunction()).toBe(true);
  });

  it('should throw error on invalid input', () => {
    expect(() => myFunction(null)).toThrow();
  });

  it('should handle empty string', () => {
    expect(myFunction('')).toBe(false);
  });
});
          `.trim()
        );

        const result = analyzeTestPatterns(tempDir);

        expect(result.totalTests).toBe(3);
        expect(result.testsWithErrorHandling).toBeGreaterThan(0);
        expect(result.testsWithEdgeCases).toBeGreaterThan(0);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should count error handling tests correctly', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(testsDir);

      try {
        fs.writeFileSync(
          path.join(testsDir, 'errors.test.ts'),
          `
describe('Error handling', () => {
  it('should throw on invalid input', () => {
    expect(() => func(null)).toThrow();
  });

  it('should reject promise on error', async () => {
    await expect(asyncFunc()).rejects.toThrow();
  });

  it('should handle error in try-catch', () => {
    try {
      func();
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});
          `.trim()
        );

        const result = analyzeTestPatterns(tempDir);

        expect(result.testsWithErrorHandling).toBeGreaterThanOrEqual(3);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should count edge case tests correctly', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(testsDir);

      try {
        fs.writeFileSync(
          path.join(testsDir, 'edges.test.ts'),
          `
describe('Edge cases', () => {
  it('should handle empty array', () => {
    expect(func([])).toEqual([]);
  });

  it('should handle null value', () => {
    expect(func(null)).toBeNull();
  });

  it('should handle undefined value', () => {
    expect(func(undefined)).toBeUndefined();
  });

  it('should handle boundary condition', () => {
    expect(func(0)).toBe(0);
  });
});
          `.trim()
        );

        const result = analyzeTestPatterns(tempDir);

        expect(result.testsWithEdgeCases).toBeGreaterThanOrEqual(4);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('findErrorTests', () => {
    it('should find error handling tests', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(testsDir);

      try {
        fs.writeFileSync(
          path.join(testsDir, 'errors.test.ts'),
          `
describe('myFunction', () => {
  it('should throw error on invalid input', () => {
    expect(() => myFunction(null)).toThrow();
  });

  it('should work correctly', () => {
    expect(myFunction()).toBe(true);
  });
});
          `.trim()
        );

        const result = findErrorTests(tempDir);

        expect(result.length).toBeGreaterThan(0);
        expect(result[0].testName).toContain('error');
        expect(result[0].testedFunction).toBe('myFunction');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should identify tests with toThrow', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(testsDir);

      try {
        fs.writeFileSync(
          path.join(testsDir, 'validation.test.ts'),
          `
describe('validation', () => {
  it('validates input', () => {
    expect(() => validate(null)).toThrow('Invalid input');
  });
});
          `.trim()
        );

        const result = findErrorTests(tempDir);

        expect(result.length).toBeGreaterThan(0);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('correlateTestsWithExports', () => {
    it('should correlate tests with exports', () => {
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
          `.trim()
        );

        // Create test file
        fs.writeFileSync(
          path.join(testsDir, 'index.test.ts'),
          `
import { testedFunction } from '../src/index';

describe('testedFunction', () => {
  it('should work', () => {
    testedFunction();
  });

  it('should throw on error', () => {
    expect(() => testedFunction()).toThrow();
  });
});
          `.trim()
        );

        const result = correlateTestsWithExports(tempDir);

        expect(result.length).toBeGreaterThanOrEqual(2);

        const testedFunc = result.find(
          (r) => r.exportName === 'testedFunction'
        );
        const untestedFunc = result.find(
          (r) => r.exportName === 'untestedFunction'
        );

        expect(testedFunc).toBeDefined();
        expect(testedFunc!.testFiles.length).toBeGreaterThan(0);
        expect(testedFunc!.hasErrorTests).toBe(true);

        expect(untestedFunc).toBeDefined();
        expect(untestedFunc!.testFiles.length).toBe(0);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should detect edge case tests', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const srcDir = path.join(tempDir, 'src');
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(srcDir);
      fs.mkdirSync(testsDir);

      try {
        fs.writeFileSync(
          path.join(srcDir, 'index.ts'),
          'export function myFunc(): void {}'
        );

        fs.writeFileSync(
          path.join(testsDir, 'index.test.ts'),
          `
import { myFunc } from '../src/index';

describe('myFunc', () => {
  it('should handle empty input', () => {
    myFunc();
  });

  it('should handle null value', () => {
    myFunc();
  });
});
          `.trim()
        );

        const result = correlateTestsWithExports(tempDir);

        const myFunc = result.find((r) => r.exportName === 'myFunc');
        expect(myFunc).toBeDefined();
        expect(myFunc!.hasEdgeCaseTests).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 6: Error Condition Testing
     * For any function that can throw errors, there should exist tests that verify
     * error throwing behavior.
     *
     * This property test verifies that the analyzer correctly identifies functions
     * with error tests and those without.
     */
    it('should correctly identify functions with error tests', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/),
              hasErrorTest: fc.boolean(),
            }),
            { minLength: 1, maxLength: 8 }
          ),
          (functions) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'audit-test-')
            );
            const srcDir = path.join(tempDir, 'src');
            const testsDir = path.join(tempDir, 'tests');
            fs.mkdirSync(srcDir);
            fs.mkdirSync(testsDir);

            try {
              // Create source file with all functions
              const sourceContent = functions
                .map((f) => `export function ${f.name}(): void {}`)
                .join('\n');

              fs.writeFileSync(path.join(srcDir, 'index.ts'), sourceContent);

              // Create test file with error tests for marked functions
              const functionsWithErrorTests = functions.filter(
                (f) => f.hasErrorTest
              );

              if (functionsWithErrorTests.length > 0) {
                const importList = functionsWithErrorTests
                  .map((f) => f.name)
                  .join(', ');
                const testContent = `
import { ${importList} } from '../src/index';

${functionsWithErrorTests
  .map(
    (f) => `
describe('${f.name}', () => {
  it('should throw error on invalid input', () => {
    expect(() => ${f.name}()).toThrow();
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

              // Run correlation analysis
              const correlations = correlateTestsWithExports(tempDir);

              // Verify each function
              for (const func of functions) {
                const correlation = correlations.find(
                  (c) => c.exportName === func.name
                );

                expect(correlation).toBeDefined();

                if (func.hasErrorTest) {
                  // Functions with error tests should be detected
                  expect(correlation!.hasErrorTests).toBe(true);
                  expect(correlation!.testFiles.length).toBeGreaterThan(0);
                } else {
                  // Functions without error tests should not have error tests
                  expect(correlation!.hasErrorTests).toBe(false);
                }
              }
            } finally {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.VERY_EXPENSIVE }
      );
    });

    /**
     * Property: Error test count should not exceed total test count
     */
    it('should ensure error tests are subset of total tests', () => {
      fc.assert(
        fc.property(
          fc.record({
            totalTests: fc.integer({ min: 0, max: 20 }),
            errorTestRatio: fc.double({ min: 0, max: 1, noNaN: true }),
          }),
          (data) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'audit-test-')
            );
            const testsDir = path.join(tempDir, 'tests');
            fs.mkdirSync(testsDir);

            try {
              const errorTests = Math.max(
                0,
                Math.floor(data.totalTests * data.errorTestRatio)
              );
              const normalTests = Math.max(0, data.totalTests - errorTests);

              // Generate test file
              const errorTestContent = Array(errorTests)
                .fill(0)
                .map(
                  (_, i) => `
  it('should throw error ${i}', () => {
    expect(() => func()).toThrow();
  });
`
                )
                .join('');

              const normalTestContent = Array(normalTests)
                .fill(0)
                .map(
                  (_, i) => `
  it('should work ${i}', () => {
    expect(func()).toBe(true);
  });
`
                )
                .join('');

              const testContent = `
describe('func', () => {
${errorTestContent}
${normalTestContent}
});
              `.trim();

              fs.writeFileSync(
                path.join(testsDir, 'test.test.ts'),
                testContent
              );

              const result = analyzeTestPatterns(tempDir);

              // Error tests should not exceed total tests
              expect(result.testsWithErrorHandling).toBeLessThanOrEqual(
                result.totalTests
              );

              // Total tests should match expected
              expect(result.totalTests).toBe(data.totalTests);

              // Error tests should be at least the number we created
              // (may be more due to pattern matching)
              expect(result.testsWithErrorHandling).toBeGreaterThanOrEqual(
                errorTests
              );
            } finally {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.VERY_EXPENSIVE }
      );
    });

    /**
     * Property: Functions with error tests should have non-empty test files
     */
    it('should ensure functions with error tests have test files', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/),
              hasErrorTest: fc.boolean(),
            }),
            { minLength: 1, maxLength: 6 }
          ),
          (functions) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'audit-test-')
            );
            const srcDir = path.join(tempDir, 'src');
            const testsDir = path.join(tempDir, 'tests');
            fs.mkdirSync(srcDir);
            fs.mkdirSync(testsDir);

            try {
              // Create source
              const sourceContent = functions
                .map((f) => `export function ${f.name}(): void {}`)
                .join('\n');
              fs.writeFileSync(path.join(srcDir, 'index.ts'), sourceContent);

              // Create tests
              const withErrorTests = functions.filter((f) => f.hasErrorTest);
              if (withErrorTests.length > 0) {
                const importList = withErrorTests.map((f) => f.name).join(', ');
                const testContent = `
import { ${importList} } from '../src/index';

${withErrorTests
  .map(
    (f) => `
describe('${f.name}', () => {
  it('should throw on error', () => {
    expect(() => ${f.name}()).toThrow();
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

              const correlations = correlateTestsWithExports(tempDir);

              for (const func of functions) {
                const correlation = correlations.find(
                  (c) => c.exportName === func.name
                );

                if (correlation && correlation.hasErrorTests) {
                  // If has error tests, must have test files
                  expect(correlation.testFiles.length).toBeGreaterThan(0);
                }
              }
            } finally {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.VERY_EXPENSIVE }
      );
    });

    /**
     * Property: Error test patterns should be consistent
     */
    it('should consistently identify error test patterns', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'should throw error',
            'should fail on invalid input',
            'should reject promise',
            'handles error condition'
          ),
          fc.constantFrom('toThrow', 'rejects', 'try-catch'),
          (testName, errorPattern) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'audit-test-')
            );
            const testsDir = path.join(tempDir, 'tests');
            fs.mkdirSync(testsDir);

            try {
              let testBody = '';
              if (errorPattern === 'toThrow') {
                testBody = 'expect(() => func()).toThrow();';
              } else if (errorPattern === 'rejects') {
                testBody = 'await expect(func()).rejects.toThrow();';
              } else {
                testBody =
                  'try { func(); } catch (e) { expect(e).toBeDefined(); }';
              }

              const testContent = `
describe('func', () => {
  it('${testName}', () => {
    ${testBody}
  });
});
              `.trim();

              fs.writeFileSync(
                path.join(testsDir, 'test.test.ts'),
                testContent
              );

              const result = analyzeTestPatterns(tempDir);

              // Should detect at least one error test
              expect(result.testsWithErrorHandling).toBeGreaterThan(0);
            } finally {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.VERY_EXPENSIVE }
      );
    });
  });
});
