/**
 * Tests for test-utils documentation validator
 * **Feature: documentation-and-coverage-audit, Property 14: Test Utility Validation**
 * **Validates: Requirements 5.5**
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CodeExample, DocumentedSymbol, ExportedSymbol } from '../../src/types';
import {
  findTestUtilsWithoutExamples,
  findTestUtilsWithoutValidationTests,
  findUndocumentedTestUtils,
  getTestUtilsValidationSummary,
  validateTestUtils,
} from '../../src/validators/test-utils-validator';

describe('Test Utils Validator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'test-utils-validator-test-')
    );
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('findUndocumentedTestUtils', () => {
    it('should return empty array when all exports are documented', () => {
      const exports: ExportedSymbol[] = [
        {
          name: 'mockFunction',
          type: 'function',
          signature: 'function mockFunction(): void',
          sourceFile: 'src/mock.ts',
          isDocumented: false,
          hasExample: false,
        },
      ];

      const documentedSymbols: DocumentedSymbol[] = [
        {
          name: 'mockFunction',
          description: 'A mock function for testing',
          location: { file: 'README.md', line: 10, column: 1 },
          hasUsageExample: true,
        },
      ];

      const result = findUndocumentedTestUtils(exports, documentedSymbols);

      expect(result).toEqual([]);
    });

    it('should return undocumented exports', () => {
      const exports: ExportedSymbol[] = [
        {
          name: 'mockFunction',
          type: 'function',
          signature: 'function mockFunction(): void',
          sourceFile: 'src/mock.ts',
          isDocumented: false,
          hasExample: false,
        },
        {
          name: 'helperFunction',
          type: 'function',
          signature: 'function helperFunction(): void',
          sourceFile: 'src/helper.ts',
          isDocumented: false,
          hasExample: false,
        },
      ];

      const documentedSymbols: DocumentedSymbol[] = [
        {
          name: 'mockFunction',
          description: 'A mock function for testing',
          location: { file: 'README.md', line: 10, column: 1 },
          hasUsageExample: true,
        },
      ];

      const result = findUndocumentedTestUtils(exports, documentedSymbols);

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('helperFunction');
    });
  });

  describe('findTestUtilsWithoutExamples', () => {
    it('should return empty array when all exports have examples', () => {
      const exports: ExportedSymbol[] = [
        {
          name: 'mockFunction',
          type: 'function',
          signature: 'function mockFunction(): void',
          sourceFile: 'src/mock.ts',
          isDocumented: false,
          hasExample: false,
        },
      ];

      const examples: CodeExample[] = [
        {
          code: 'import { mockFunction } from "./test-utils";\nmockFunction();',
          language: 'typescript',
          location: { file: 'README.md', line: 20, column: 1 },
          referencedSymbols: ['mockFunction'],
          hasTest: false,
        },
      ];

      const result = findTestUtilsWithoutExamples(exports, examples);

      expect(result).toEqual([]);
    });

    it('should return exports without examples', () => {
      const exports: ExportedSymbol[] = [
        {
          name: 'mockFunction',
          type: 'function',
          signature: 'function mockFunction(): void',
          sourceFile: 'src/mock.ts',
          isDocumented: false,
          hasExample: false,
        },
        {
          name: 'helperFunction',
          type: 'function',
          signature: 'function helperFunction(): void',
          sourceFile: 'src/helper.ts',
          isDocumented: false,
          hasExample: false,
        },
      ];

      const examples: CodeExample[] = [
        {
          code: 'import { mockFunction } from "./test-utils";\nmockFunction();',
          language: 'typescript',
          location: { file: 'README.md', line: 20, column: 1 },
          referencedSymbols: ['mockFunction'],
          hasTest: false,
        },
      ];

      const result = findTestUtilsWithoutExamples(exports, examples);

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('helperFunction');
    });
  });

  describe('findTestUtilsWithoutValidationTests', () => {
    it('should return all exports when no test directory exists', () => {
      const packagePath = tempDir;
      const exports: ExportedSymbol[] = [
        {
          name: 'mockFunction',
          type: 'function',
          signature: 'function mockFunction(): void',
          sourceFile: 'src/mock.ts',
          isDocumented: false,
          hasExample: false,
        },
      ];

      const result = findTestUtilsWithoutValidationTests(exports, packagePath);

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('mockFunction');
    });

    it('should return empty array when all exports have tests', () => {
      const packagePath = tempDir;
      const testsDir = path.join(packagePath, 'tests');
      fs.mkdirSync(testsDir);

      // Create a test file
      const testFile = path.join(testsDir, 'mock.test.ts');
      fs.writeFileSync(
        testFile,
        `import { mockFunction } from '../src/mock';\n\ntest('mockFunction works', () => {});`
      );

      const exports: ExportedSymbol[] = [
        {
          name: 'mockFunction',
          type: 'function',
          signature: 'function mockFunction(): void',
          sourceFile: 'src/mock.ts',
          isDocumented: false,
          hasExample: false,
        },
      ];

      const result = findTestUtilsWithoutValidationTests(exports, packagePath);

      expect(result).toEqual([]);
    });

    it('should return exports without tests', () => {
      const packagePath = tempDir;
      const testsDir = path.join(packagePath, 'tests');
      fs.mkdirSync(testsDir);

      // Create a test file for only one export
      const testFile = path.join(testsDir, 'mock.test.ts');
      fs.writeFileSync(
        testFile,
        `import { mockFunction } from '../src/mock';\n\ntest('mockFunction works', () => {});`
      );

      const exports: ExportedSymbol[] = [
        {
          name: 'mockFunction',
          type: 'function',
          signature: 'function mockFunction(): void',
          sourceFile: 'src/mock.ts',
          isDocumented: false,
          hasExample: false,
        },
        {
          name: 'helperFunction',
          type: 'function',
          signature: 'function helperFunction(): void',
          sourceFile: 'src/helper.ts',
          isDocumented: false,
          hasExample: false,
        },
      ];

      const result = findTestUtilsWithoutValidationTests(exports, packagePath);

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('helperFunction');
    });
  });

  describe('validateTestUtils', () => {
    it('should return errors for missing README', () => {
      const packagePath = tempDir;

      // Create package.json
      const packageJson = {
        name: '@test/utils',
        version: '1.0.0',
      };
      fs.writeFileSync(
        path.join(packagePath, 'package.json'),
        JSON.stringify(packageJson)
      );

      // Create src directory with index.ts
      const srcDir = path.join(packagePath, 'src');
      fs.mkdirSync(srcDir);
      fs.writeFileSync(
        path.join(srcDir, 'index.ts'),
        'export function mockFunction() {}'
      );

      const result = validateTestUtils(packagePath);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.type === 'MissingReadme')).toBe(true);
    });

    it('should return errors for undocumented exports', () => {
      const packagePath = tempDir;

      // Create package.json
      const packageJson = {
        name: '@test/utils',
        version: '1.0.0',
      };
      fs.writeFileSync(
        path.join(packagePath, 'package.json'),
        JSON.stringify(packageJson)
      );

      // Create src directory with index.ts
      const srcDir = path.join(packagePath, 'src');
      fs.mkdirSync(srcDir);
      fs.writeFileSync(
        path.join(srcDir, 'index.ts'),
        'export function mockFunction() {}'
      );

      // Create empty README
      fs.writeFileSync(path.join(packagePath, 'README.md'), '# Test Utils\n');

      const result = validateTestUtils(packagePath);

      expect(result.errors.some((e) => e.type === 'UndocumentedTestUtil')).toBe(
        true
      );
    });
  });

  describe('getTestUtilsValidationSummary', () => {
    it('should calculate correct percentages', () => {
      const result = {
        packageName: '@test/utils',
        exports: [
          {
            name: 'mockFunction',
            type: 'function' as const,
            signature: 'function mockFunction(): void',
            sourceFile: 'src/mock.ts',
            isDocumented: false,
            hasExample: false,
          },
          {
            name: 'helperFunction',
            type: 'function' as const,
            signature: 'function helperFunction(): void',
            sourceFile: 'src/helper.ts',
            isDocumented: false,
            hasExample: false,
          },
        ],
        documentedSymbols: [],
        examples: [],
        undocumentedExports: [
          {
            name: 'helperFunction',
            type: 'function' as const,
            signature: 'function helperFunction(): void',
            sourceFile: 'src/helper.ts',
            isDocumented: false,
            hasExample: false,
          },
        ],
        exportsWithoutExamples: [
          {
            name: 'helperFunction',
            type: 'function' as const,
            signature: 'function helperFunction(): void',
            sourceFile: 'src/helper.ts',
            isDocumented: false,
            hasExample: false,
          },
        ],
        exportsWithoutValidationTests: [
          {
            name: 'mockFunction',
            type: 'function' as const,
            signature: 'function mockFunction(): void',
            sourceFile: 'src/mock.ts',
            isDocumented: false,
            hasExample: false,
          },
          {
            name: 'helperFunction',
            type: 'function' as const,
            signature: 'function helperFunction(): void',
            sourceFile: 'src/helper.ts',
            isDocumented: false,
            hasExample: false,
          },
        ],
        errors: [],
      };

      const summary = getTestUtilsValidationSummary(result);

      expect(summary.totalExports).toBe(2);
      expect(summary.documentedCount).toBe(1);
      expect(summary.documentationPercentage).toBe(50);
      expect(summary.examplesCount).toBe(1);
      expect(summary.examplesPercentage).toBe(50);
      expect(summary.validatedCount).toBe(0);
      expect(summary.validationPercentage).toBe(0);
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 14: Test Utility Validation
     * For any test utility documented in test-utils README, there should exist tests
     * that validate the utility works as documented.
     *
     * **Feature: documentation-and-coverage-audit, Property 14: Test Utility Validation**
     * **Validates: Requirements 5.5**
     */
    it('should validate that all documented test utilities have validation tests', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              utilName: fc
                .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
                .filter((s) => s.length >= 3 && s.length <= 20),
              isDocumented: fc.boolean(),
              hasExample: fc.boolean(),
              hasTest: fc.boolean(),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (utilSpecs) => {
            // Test the individual functions directly instead of full validation
            // to avoid expensive TypeScript parsing

            // Create mock exports
            const exports: ExportedSymbol[] = utilSpecs.map((spec) => ({
              name: spec.utilName,
              type: 'function' as const,
              signature: `function ${spec.utilName}(): void`,
              sourceFile: 'src/index.ts',
              isDocumented: false,
              hasExample: false,
            }));

            // Create mock documented symbols
            const documentedSymbols: DocumentedSymbol[] = utilSpecs
              .filter((s) => s.isDocumented)
              .map((spec) => ({
                name: spec.utilName,
                description: `Description of ${spec.utilName}`,
                location: { file: 'README.md', line: 1, column: 1 },
                hasUsageExample: spec.hasExample,
              }));

            // Create mock examples
            const examples: CodeExample[] = utilSpecs
              .filter((s) => s.hasExample)
              .map((spec) => ({
                code: `import { ${spec.utilName} } from '@test/utils';\n${spec.utilName}();`,
                language: 'typescript',
                location: { file: 'README.md', line: 1, column: 1 },
                referencedSymbols: [spec.utilName],
                hasTest: false,
              }));

            // Test findUndocumentedTestUtils
            const undocumented = findUndocumentedTestUtils(
              exports,
              documentedSymbols
            );
            const expectedUndocumented = utilSpecs.filter(
              (s) => !s.isDocumented
            );
            expect(undocumented.length).toBe(expectedUndocumented.length);

            // Test findTestUtilsWithoutExamples
            const withoutExamples = findTestUtilsWithoutExamples(
              exports,
              examples
            );
            const expectedWithoutExamples = utilSpecs.filter(
              (s) => !s.hasExample
            );
            expect(withoutExamples.length).toBe(expectedWithoutExamples.length);

            // For testing validation tests, we need to create a temp directory
            // but only with test files, not full TypeScript parsing
            const packagePath = fs.mkdtempSync(
              path.join(os.tmpdir(), 'pbt-test-utils-')
            );

            try {
              const testsDir = path.join(packagePath, 'tests');
              fs.mkdirSync(testsDir);

              for (const spec of utilSpecs) {
                if (spec.hasTest) {
                  const testFile = path.join(
                    testsDir,
                    `${spec.utilName}.test.ts`
                  );
                  fs.writeFileSync(
                    testFile,
                    `import { ${spec.utilName} } from '../src/index';\n\ntest('${spec.utilName} works', () => {});`
                  );
                }
              }

              const withoutTests = findTestUtilsWithoutValidationTests(
                exports,
                packagePath
              );
              const expectedWithoutTests = utilSpecs.filter((s) => !s.hasTest);
              expect(withoutTests.length).toBe(expectedWithoutTests.length);
            } finally {
              if (fs.existsSync(packagePath)) {
                fs.rmSync(packagePath, { recursive: true, force: true });
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: Documentation completeness should be monotonic
     * Adding documentation should never decrease the documentation percentage
     */
    it('should have monotonic documentation completeness', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc
              .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
              .filter((s) => s.length >= 3 && s.length <= 20),
            { minLength: 1, maxLength: 3 }
          ),
          fc.integer({ min: 0, max: 3 }),
          (utilNames, documentedCount) => {
            // Test monotonicity using the function directly
            const actualDocumentedCount = Math.min(
              documentedCount,
              utilNames.length
            );

            // Create mock exports
            const exports: ExportedSymbol[] = utilNames.map((name) => ({
              name,
              type: 'function' as const,
              signature: `function ${name}(): void`,
              sourceFile: 'src/index.ts',
              isDocumented: false,
              hasExample: false,
            }));

            // Create documented symbols for first set
            const documentedSymbols1: DocumentedSymbol[] = utilNames
              .slice(0, actualDocumentedCount)
              .map((name) => ({
                name,
                description: `Description of ${name}`,
                location: { file: 'README.md', line: 1, column: 1 },
                hasUsageExample: false,
              }));

            const undocumented1 = findUndocumentedTestUtils(
              exports,
              documentedSymbols1
            );
            const percentage1 =
              ((exports.length - undocumented1.length) / exports.length) * 100;

            // Add one more documented symbol
            const additionalDocs = Math.min(
              1,
              utilNames.length - actualDocumentedCount
            );
            if (additionalDocs > 0) {
              const documentedSymbols2: DocumentedSymbol[] = utilNames
                .slice(0, actualDocumentedCount + additionalDocs)
                .map((name) => ({
                  name,
                  description: `Description of ${name}`,
                  location: { file: 'README.md', line: 1, column: 1 },
                  hasUsageExample: false,
                }));

              const undocumented2 = findUndocumentedTestUtils(
                exports,
                documentedSymbols2
              );
              const percentage2 =
                ((exports.length - undocumented2.length) / exports.length) *
                100;

              // Documentation percentage should not decrease
              expect(percentage2).toBeGreaterThanOrEqual(percentage1);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: Validation should be deterministic
     */
    it('should produce consistent results across multiple validation runs', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc
              .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
              .filter((s) => s.length >= 3 && s.length <= 20),
            { minLength: 1, maxLength: 3 }
          ),
          (utilNames) => {
            // Test determinism using the functions directly
            const exports: ExportedSymbol[] = utilNames.map((name) => ({
              name,
              type: 'function' as const,
              signature: `function ${name}(): void`,
              sourceFile: 'src/index.ts',
              isDocumented: false,
              hasExample: false,
            }));

            const documentedSymbols: DocumentedSymbol[] = [];
            const examples: CodeExample[] = [];

            // Run the same analysis multiple times
            const undocumented1 = findUndocumentedTestUtils(
              exports,
              documentedSymbols
            );
            const undocumented2 = findUndocumentedTestUtils(
              exports,
              documentedSymbols
            );
            const undocumented3 = findUndocumentedTestUtils(
              exports,
              documentedSymbols
            );

            // Results should be identical
            expect(undocumented1.length).toBe(undocumented2.length);
            expect(undocumented2.length).toBe(undocumented3.length);

            const withoutExamples1 = findTestUtilsWithoutExamples(
              exports,
              examples
            );
            const withoutExamples2 = findTestUtilsWithoutExamples(
              exports,
              examples
            );

            expect(withoutExamples1.length).toBe(withoutExamples2.length);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: All exports should be accounted for
     */
    it('should account for all exports in validation results', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc
              .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
              .filter((s) => s.length >= 3 && s.length <= 20),
            { minLength: 1, maxLength: 3 }
          ),
          (utilNames) => {
            // Test accounting using the functions directly
            const exports: ExportedSymbol[] = utilNames.map((name) => ({
              name,
              type: 'function' as const,
              signature: `function ${name}(): void`,
              sourceFile: 'src/index.ts',
              isDocumented: false,
              hasExample: false,
            }));

            const documentedSymbols: DocumentedSymbol[] = [];
            const examples: CodeExample[] = [];

            // All exports should be undocumented (since no documentation)
            const undocumented = findUndocumentedTestUtils(
              exports,
              documentedSymbols
            );
            expect(undocumented.length).toBe(utilNames.length);

            // All exports should be without examples
            const withoutExamples = findTestUtilsWithoutExamples(
              exports,
              examples
            );
            expect(withoutExamples.length).toBe(utilNames.length);

            // Test with temp directory for validation tests
            const packagePath = fs.mkdtempSync(
              path.join(os.tmpdir(), 'pbt-accounting-')
            );

            try {
              // No test directory, so all should be without tests
              const withoutTests = findTestUtilsWithoutValidationTests(
                exports,
                packagePath
              );
              expect(withoutTests.length).toBe(utilNames.length);
            } finally {
              if (fs.existsSync(packagePath)) {
                fs.rmSync(packagePath, { recursive: true, force: true });
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: Summary percentages should be in valid range [0, 100]
     */
    it('should always produce valid percentage values', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              utilName: fc
                .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
                .filter((s) => s.length >= 3 && s.length <= 20),
              isDocumented: fc.boolean(),
              hasExample: fc.boolean(),
              hasTest: fc.boolean(),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (utilSpecs) => {
            // Test percentages using mock data
            const exports: ExportedSymbol[] = utilSpecs.map((spec) => ({
              name: spec.utilName,
              type: 'function' as const,
              signature: `function ${spec.utilName}(): void`,
              sourceFile: 'src/index.ts',
              isDocumented: false,
              hasExample: false,
            }));

            const documentedSymbols: DocumentedSymbol[] = utilSpecs
              .filter((s) => s.isDocumented)
              .map((spec) => ({
                name: spec.utilName,
                description: `Description of ${spec.utilName}`,
                location: { file: 'README.md', line: 1, column: 1 },
                hasUsageExample: spec.hasExample,
              }));

            const examples: CodeExample[] = utilSpecs
              .filter((s) => s.hasExample)
              .map((spec) => ({
                code: `import { ${spec.utilName} } from '@test/utils';`,
                language: 'typescript',
                location: { file: 'README.md', line: 1, column: 1 },
                referencedSymbols: [spec.utilName],
                hasTest: false,
              }));

            const undocumented = findUndocumentedTestUtils(
              exports,
              documentedSymbols
            );
            const withoutExamples = findTestUtilsWithoutExamples(
              exports,
              examples
            );

            // Create mock result
            const result = {
              packageName: '@test/utils',
              exports,
              documentedSymbols,
              examples,
              undocumentedExports: undocumented,
              exportsWithoutExamples: withoutExamples,
              exportsWithoutValidationTests: exports.filter(
                (e) => !utilSpecs.find((s) => s.utilName === e.name)?.hasTest
              ),
              errors: [],
            };

            const summary = getTestUtilsValidationSummary(result);

            // All percentages should be in valid range
            expect(summary.documentationPercentage).toBeGreaterThanOrEqual(0);
            expect(summary.documentationPercentage).toBeLessThanOrEqual(100);

            expect(summary.examplesPercentage).toBeGreaterThanOrEqual(0);
            expect(summary.examplesPercentage).toBeLessThanOrEqual(100);

            expect(summary.validationPercentage).toBeGreaterThanOrEqual(0);
            expect(summary.validationPercentage).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
