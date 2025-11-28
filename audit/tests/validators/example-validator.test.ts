/**
 * Tests for example validator
 * **Feature: documentation-and-coverage-audit, Property 7: Example Validation**
 * **Validates: Requirements 2.5**
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CodeExample, TestFile } from '../../src/types';
import {
  crossReferenceExamplesWithTests,
  findTestsForExamples,
  validateExampleExecutability,
  validateExamples,
} from '../../src/validators/example-validator';
import { PROPERTY_TEST_CONFIG } from '../test-config';

describe('Example Validator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'example-validator-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('findTestsForExamples', () => {
    it('should return empty array when no test directory exists', () => {
      const packagePath = tempDir;
      const examples: CodeExample[] = [];

      const result = findTestsForExamples(examples, packagePath);

      expect(result).toEqual([]);
    });

    it('should find test files that import symbols from examples', () => {
      const packagePath = tempDir;
      const testsDir = path.join(packagePath, 'tests');
      fs.mkdirSync(testsDir);

      // Create a test file
      const testFile = path.join(testsDir, 'example.test.ts');
      fs.writeFileSync(
        testFile,
        `import { myFunction } from '../src/module';\n\ntest('myFunction works', () => {});`
      );

      // Create examples that reference myFunction
      const examples: CodeExample[] = [
        {
          code: 'import { myFunction } from "./module";\nmyFunction();',
          language: 'typescript',
          location: { file: 'README.md', line: 1, column: 1 },
          referencedSymbols: ['myFunction'],
          hasTest: false,
        },
      ];

      const result = findTestsForExamples(examples, packagePath);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].imports).toContain('myFunction');
    });

    it('should search both tests and test directories', () => {
      const packagePath = tempDir;
      const testDir = path.join(packagePath, 'test');
      fs.mkdirSync(testDir);

      // Create a test file in 'test' directory
      const testFile = path.join(testDir, 'example.test.ts');
      fs.writeFileSync(
        testFile,
        `import { myFunction } from '../src/module';\n\ntest('myFunction works', () => {});`
      );

      const examples: CodeExample[] = [
        {
          code: 'import { myFunction } from "./module";\nmyFunction();',
          language: 'typescript',
          location: { file: 'README.md', line: 1, column: 1 },
          referencedSymbols: ['myFunction'],
          hasTest: false,
        },
      ];

      const result = findTestsForExamples(examples, packagePath);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].imports).toContain('myFunction');
    });
  });

  describe('validateExampleExecutability', () => {
    it('should return null for valid TypeScript code', () => {
      const example: CodeExample = {
        code: 'const x = 42;\nfunction test() { return x; }',
        language: 'typescript',
        location: { file: 'README.md', line: 1, column: 1 },
        referencedSymbols: [],
        hasTest: false,
      };

      const result = validateExampleExecutability(example);

      expect(result).toBeNull();
    });

    it('should return null for non-TypeScript/JavaScript examples', () => {
      const example: CodeExample = {
        code: 'echo "test"',
        language: 'bash',
        location: { file: 'README.md', line: 1, column: 1 },
        referencedSymbols: [],
        hasTest: false,
      };

      const result = validateExampleExecutability(example);

      expect(result).toBeNull();
    });

    it('should detect unmatched braces', () => {
      const example: CodeExample = {
        code: 'function test() { const x = 42;',
        language: 'typescript',
        location: { file: 'README.md', line: 1, column: 1 },
        referencedSymbols: [],
        hasTest: false,
      };

      const result = validateExampleExecutability(example);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('InvalidExampleSyntax');
      expect(result?.message).toContain('Unmatched braces');
    });
  });

  describe('crossReferenceExamplesWithTests', () => {
    it('should mark examples as tested when test files exist', () => {
      const examples: CodeExample[] = [
        {
          code: 'import { myFunction } from "./module";\nmyFunction();',
          language: 'typescript',
          location: { file: 'README.md', line: 1, column: 1 },
          referencedSymbols: ['myFunction'],
          hasTest: false,
        },
      ];

      const testFiles: TestFile[] = [
        {
          path: '/path/to/test.ts',
          imports: ['myFunction'],
        },
      ];

      const result = crossReferenceExamplesWithTests(examples, testFiles);

      expect(result[0].hasTest).toBe(true);
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 7: Example Validation
     * For any code example in a README, there should exist either a corresponding test
     * or the example should be executable without errors.
     *
     * **Feature: documentation-and-coverage-audit, Property 7: Example Validation**
     * **Validates: Requirements 2.5**
     */
    it('should validate that examples with tests are marked correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              symbolName: fc
                .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
                .filter((s) => s.length >= 3),
              hasTest: fc.boolean(),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (exampleSpecs) => {
            const packagePath = fs.mkdtempSync(
              path.join(os.tmpdir(), 'pbt-validate-')
            );

            try {
              // Create examples
              const examples: CodeExample[] = exampleSpecs.map((spec, i) => ({
                code: `import { ${spec.symbolName} } from "./module";\n${spec.symbolName}();`,
                language: 'typescript',
                location: { file: 'README.md', line: i * 5 + 1, column: 1 },
                referencedSymbols: [spec.symbolName],
                hasTest: false,
              }));

              // Create test files for symbols that should have tests
              const testsDir = path.join(packagePath, 'tests');
              fs.mkdirSync(testsDir);

              for (const spec of exampleSpecs) {
                if (spec.hasTest) {
                  const testFile = path.join(
                    testsDir,
                    `${spec.symbolName}.test.ts`
                  );
                  fs.writeFileSync(
                    testFile,
                    `import { ${spec.symbolName} } from '../src/module';\n\ntest('${spec.symbolName} works', () => {});`
                  );
                }
              }

              // Find tests and cross-reference
              const testFiles = findTestsForExamples(examples, packagePath);
              const updatedExamples = crossReferenceExamplesWithTests(
                examples,
                testFiles
              );

              // Verify that hasTest flag matches expected
              for (let i = 0; i < updatedExamples.length; i++) {
                const example = updatedExamples[i];
                const spec = exampleSpecs[i];

                expect(example.hasTest).toBe(spec.hasTest);
              }
            } finally {
              if (fs.existsSync(packagePath)) {
                fs.rmSync(packagePath, { recursive: true, force: true });
              }
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.SIMPLE }
      );
    });

    /**
     * Property: Syntax validation should detect unmatched delimiters
     */
    it('should detect unmatched delimiters in any code example', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            { open: '{', close: '}', name: 'braces' },
            { open: '(', close: ')', name: 'parentheses' },
            { open: '[', close: ']', name: 'brackets' }
          ),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 0, max: 4 }),
          (delimiter, openCount, closeCount) => {
            // Skip balanced cases
            if (openCount === closeCount) {
              return true;
            }

            const code =
              delimiter.open.repeat(openCount) +
              ' const x = 42; ' +
              delimiter.close.repeat(closeCount);

            const example: CodeExample = {
              code,
              language: 'typescript',
              location: { file: 'README.md', line: 1, column: 1 },
              referencedSymbols: [],
              hasTest: false,
            };

            const result = validateExampleExecutability(example);

            // Should detect the mismatch
            expect(result).not.toBeNull();
            expect(result?.type).toBe('InvalidExampleSyntax');
            expect(result?.message.toLowerCase()).toContain(
              delimiter.name.toLowerCase()
            );
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.SIMPLE }
      );
    });

    /**
     * Property: Cross-referencing should be transitive
     */
    it('should mark examples as tested when any referenced symbol is tested', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc
              .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
              .filter((s) => s.length >= 3),
            { minLength: 1, maxLength: 5 }
          ),
          fc.array(
            fc
              .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
              .filter((s) => s.length >= 3),
            { minLength: 1, maxLength: 5 }
          ),
          (exampleSymbols, testedSymbols) => {
            const examples: CodeExample[] = [
              {
                code: `import { ${exampleSymbols.join(
                  ', '
                )} } from "./module";`,
                language: 'typescript',
                location: { file: 'README.md', line: 1, column: 1 },
                referencedSymbols: exampleSymbols,
                hasTest: false,
              },
            ];

            const testFiles: TestFile[] = [
              {
                path: '/path/to/test.ts',
                imports: testedSymbols,
              },
            ];

            const result = crossReferenceExamplesWithTests(examples, testFiles);

            // Check if any example symbol is in tested symbols
            const hasOverlap = exampleSymbols.some((sym) =>
              testedSymbols.includes(sym)
            );

            expect(result[0].hasTest).toBe(hasOverlap);
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.SIMPLE }
      );
    });

    /**
     * Property: Valid code should never produce syntax errors
     */
    it('should not report syntax errors for well-formed code', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Variable declarations
            fc
              .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
              .map((name) => `const ${name} = 42;`),
            // Function declarations
            fc
              .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
              .map((name) => `function ${name}() { return 42; }`),
            // Class declarations
            fc
              .stringMatching(/^[A-Z][a-zA-Z0-9]*$/)
              .map((name) => `class ${name} { constructor() {} }`),
            // Import statements
            fc
              .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
              .map((name) => `import { ${name} } from './module';`)
          ),
          (code) => {
            const example: CodeExample = {
              code,
              language: 'typescript',
              location: { file: 'README.md', line: 1, column: 1 },
              referencedSymbols: [],
              hasTest: false,
            };

            const result = validateExampleExecutability(example);

            expect(result).toBeNull();
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.SIMPLE }
      );
    });
  });
});

describe('Automated Example Verification', () => {
  /**
   * Property 16: Automated Example Verification
   * For any package, running the validation script should verify that all documented
   * examples have corresponding tests.
   *
   * **Feature: documentation-and-coverage-audit, Property 16: Automated Example Verification**
   * **Validates: Requirements 6.2**
   */
  it('should automatically verify all examples have tests when validation runs', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            symbolName: fc
              .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
              .filter((s) => s.length >= 3),
            hasTest: fc.boolean(),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (exampleSpecs) => {
          const packagePath = fs.mkdtempSync(
            path.join(os.tmpdir(), 'pbt-auto-verify-')
          );

          try {
            // Create README with examples
            const readmePath = path.join(packagePath, 'README.md');
            let readmeContent = '# Package\n\n## Examples\n\n';

            for (const spec of exampleSpecs) {
              readmeContent += `\`\`\`typescript\nimport { ${spec.symbolName} } from "./module";\n${spec.symbolName}();\n\`\`\`\n\n`;
            }

            fs.writeFileSync(readmePath, readmeContent);

            // Create test files for symbols that should have tests
            const testsDir = path.join(packagePath, 'tests');
            fs.mkdirSync(testsDir);

            for (const spec of exampleSpecs) {
              if (spec.hasTest) {
                const testFile = path.join(
                  testsDir,
                  `${spec.symbolName}.test.ts`
                );
                fs.writeFileSync(
                  testFile,
                  `import { ${spec.symbolName} } from '../src/module';\n\ntest('${spec.symbolName} works', () => {});`
                );
              }
            }

            // Run validation (this is what would be called in CI/CD)
            const errors = validateExamples(readmePath, packagePath);

            // Count expected untested examples
            const expectedUntestedCount = exampleSpecs.filter(
              (spec) => !spec.hasTest
            ).length;

            // Filter for UntestedExample errors
            const untestedErrors = errors.filter(
              (e) => e.type === 'UntestedExample'
            );

            // Should detect all untested examples
            expect(untestedErrors.length).toBe(expectedUntestedCount);

            // Each untested example should be reported
            for (const spec of exampleSpecs) {
              if (!spec.hasTest) {
                const hasError = untestedErrors.some((err) =>
                  err.message.includes(spec.symbolName)
                );
                expect(hasError).toBe(true);
              }
            }
          } finally {
            if (fs.existsSync(packagePath)) {
              fs.rmSync(packagePath, { recursive: true, force: true });
            }
          }
        }
      ),
      { numRuns: PROPERTY_TEST_CONFIG.SIMPLE }
    );
  });

  /**
   * Property: Validation should be deterministic
   */
  it('should produce consistent results across multiple validation runs', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/).filter((s) => s.length >= 3),
          { minLength: 1, maxLength: 3 }
        ),
        (symbolNames) => {
          const packagePath = fs.mkdtempSync(
            path.join(os.tmpdir(), 'pbt-deterministic-')
          );

          try {
            // Create README with examples
            const readmePath = path.join(packagePath, 'README.md');
            let readmeContent = '# Package\n\n## Examples\n\n';

            for (const symbol of symbolNames) {
              readmeContent += `\`\`\`typescript\nimport { ${symbol} } from "./module";\n${symbol}();\n\`\`\`\n\n`;
            }

            fs.writeFileSync(readmePath, readmeContent);

            // Run validation multiple times
            const errors1 = validateExamples(readmePath, packagePath);
            const errors2 = validateExamples(readmePath, packagePath);
            const errors3 = validateExamples(readmePath, packagePath);

            // Results should be identical
            expect(errors1.length).toBe(errors2.length);
            expect(errors2.length).toBe(errors3.length);

            // Error types should match
            const types1 = errors1.map((e) => e.type).sort();
            const types2 = errors2.map((e) => e.type).sort();
            const types3 = errors3.map((e) => e.type).sort();

            expect(types1).toEqual(types2);
            expect(types2).toEqual(types3);
          } finally {
            if (fs.existsSync(packagePath)) {
              fs.rmSync(packagePath, { recursive: true, force: true });
            }
          }
        }
      ),
      { numRuns: PROPERTY_TEST_CONFIG.STANDARD }
    );
  });

  /**
   * Property: Validation should handle empty packages gracefully
   */
  it('should return no errors for packages with no examples', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          '# Package\n\nNo examples here.',
          '# Package\n\n## Installation\n\nnpm install',
          '# Package\n\n## API\n\nSee docs.'
        ),
        (readmeContent) => {
          const packagePath = fs.mkdtempSync(
            path.join(os.tmpdir(), 'pbt-empty-')
          );

          try {
            const readmePath = path.join(packagePath, 'README.md');
            fs.writeFileSync(readmePath, readmeContent);

            const errors = validateExamples(readmePath, packagePath);

            // Should have no errors for packages without examples
            expect(errors).toEqual([]);
          } finally {
            if (fs.existsSync(packagePath)) {
              fs.rmSync(packagePath, { recursive: true, force: true });
            }
          }
        }
      ),
      { numRuns: PROPERTY_TEST_CONFIG.STANDARD }
    );
  });

  /**
   * Property: Validation should detect all syntax errors
   */
  it('should detect syntax errors in all examples', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            code: fc.constantFrom(
              'function test() { const x = 42;', // Missing closing brace
              'const result = myFunction(arg1, arg2;', // Missing closing paren
              'const arr = [1, 2, 3;', // Missing closing bracket
              'const str = "hello;', // Missing closing quote
              'import { myFunction }' // Incomplete import
            ),
            language: fc.constantFrom('typescript', 'javascript'),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (exampleSpecs) => {
          const packagePath = fs.mkdtempSync(
            path.join(os.tmpdir(), 'pbt-syntax-')
          );

          try {
            // Create README with examples
            const readmePath = path.join(packagePath, 'README.md');
            let readmeContent = '# Package\n\n## Examples\n\n';

            for (const spec of exampleSpecs) {
              readmeContent += `\`\`\`${spec.language}\n${spec.code}\n\`\`\`\n\n`;
            }

            fs.writeFileSync(readmePath, readmeContent);

            // Run validation
            const errors = validateExamples(readmePath, packagePath);

            // Should detect syntax errors in all examples
            const syntaxErrors = errors.filter(
              (e) => e.type === 'InvalidExampleSyntax'
            );

            expect(syntaxErrors.length).toBe(exampleSpecs.length);
          } finally {
            if (fs.existsSync(packagePath)) {
              fs.rmSync(packagePath, { recursive: true, force: true });
            }
          }
        }
      ),
      { numRuns: PROPERTY_TEST_CONFIG.STANDARD }
    );
  });

  /**
   * Property: Validation should not report errors for tested examples
   */
  it('should not report untested errors when all examples have tests', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/).filter((s) => s.length >= 3),
          { minLength: 1, maxLength: 5 }
        ),
        (symbolNames) => {
          const packagePath = fs.mkdtempSync(
            path.join(os.tmpdir(), 'pbt-all-tested-')
          );

          try {
            // Create README with examples
            const readmePath = path.join(packagePath, 'README.md');
            let readmeContent = '# Package\n\n## Examples\n\n';

            for (const symbol of symbolNames) {
              readmeContent += `\`\`\`typescript\nimport { ${symbol} } from "./module";\n${symbol}();\n\`\`\`\n\n`;
            }

            fs.writeFileSync(readmePath, readmeContent);

            // Create test files for ALL symbols
            const testsDir = path.join(packagePath, 'tests');
            fs.mkdirSync(testsDir);

            for (const symbol of symbolNames) {
              const testFile = path.join(testsDir, `${symbol}.test.ts`);
              fs.writeFileSync(
                testFile,
                `import { ${symbol} } from '../src/module';\n\ntest('${symbol} works', () => {});`
              );
            }

            // Run validation
            const errors = validateExamples(readmePath, packagePath);

            // Should have no UntestedExample errors
            const untestedErrors = errors.filter(
              (e) => e.type === 'UntestedExample'
            );

            expect(untestedErrors).toEqual([]);
          } finally {
            if (fs.existsSync(packagePath)) {
              fs.rmSync(packagePath, { recursive: true, force: true });
            }
          }
        }
      ),
      { numRuns: PROPERTY_TEST_CONFIG.SIMPLE }
    );
  });
});
