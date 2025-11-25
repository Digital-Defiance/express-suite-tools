/**
 * Tests for testing approach documentation validator
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  extractCrossPackageTestDocs,
  extractTestPatternExamples,
  getTestingApproachValidationSummary,
  hasCrossPackageDependencies,
  hasTestingSection,
  validateTestingApproach,
} from '../../src/validators/testing-approach-validator';

describe('Testing Approach Validator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'testing-approach-validator-test-')
    );
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('hasTestingSection', () => {
    it('should return false when README does not exist', () => {
      const result = hasTestingSection(
        path.join(tempDir, 'nonexistent-README.md')
      );
      expect(result.hasSection).toBe(false);
    });

    it('should return true when README has testing section', () => {
      const readmePath = path.join(tempDir, 'README.md');
      fs.writeFileSync(
        readmePath,
        '# My Package\n\n## Testing\n\nThis is how to test.'
      );

      const result = hasTestingSection(readmePath);
      expect(result.hasSection).toBe(true);
      expect(result.location).toBeDefined();
      expect(result.location?.line).toBe(3);
    });

    it('should detect various testing section headers', () => {
      const headers = [
        '## Testing',
        '## Tests',
        '## Test Approach',
        '## Testing Approach',
        '## Testing Strategy',
        '## Running Tests',
        '## How to Test',
        '### testing',
        '# TESTING',
      ];

      for (const header of headers) {
        const readmePath = path.join(
          tempDir,
          `README-${headers.indexOf(header)}.md`
        );
        fs.writeFileSync(readmePath, `# Package\n\n${header}\n\nContent`);

        const result = hasTestingSection(readmePath);
        expect(result.hasSection).toBe(true);
      }
    });

    it('should return false when no testing section exists', () => {
      const readmePath = path.join(tempDir, 'README.md');
      fs.writeFileSync(
        readmePath,
        '# My Package\n\n## Installation\n\n## Usage'
      );

      const result = hasTestingSection(readmePath);
      expect(result.hasSection).toBe(false);
    });
  });

  describe('extractTestPatternExamples', () => {
    it('should return empty array when README does not exist', () => {
      const result = extractTestPatternExamples(
        path.join(tempDir, 'nonexistent-README.md')
      );
      expect(result).toEqual([]);
    });

    it('should extract test code blocks', () => {
      const readmePath = path.join(tempDir, 'README.md');
      const content = `# Package

## Testing

\`\`\`typescript
import { myFunction } from './index';

test('myFunction works', () => {
  expect(myFunction()).toBe(true);
});
\`\`\`
`;
      fs.writeFileSync(readmePath, content);

      const result = extractTestPatternExamples(readmePath);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].code).toContain('test(');
      expect(result[0].code).toContain('expect(');
    });

    it('should identify different test patterns', () => {
      const readmePath = path.join(tempDir, 'README.md');
      const content = `# Package

## Testing

\`\`\`typescript
describe('MyClass', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
\`\`\`

\`\`\`typescript
test('simple test', () => {
  expect(1 + 1).toBe(2);
});
\`\`\`
`;
      fs.writeFileSync(readmePath, content);

      const result = extractTestPatternExamples(readmePath);
      expect(result.length).toBe(2);
      expect(result[0].pattern).toContain('describe/it');
      expect(result[1].pattern).toContain('test()');
    });

    it('should not extract non-test code blocks', () => {
      const readmePath = path.join(tempDir, 'README.md');
      const content = `# Package

## Usage

\`\`\`typescript
import { myFunction } from './index';
const result = myFunction();
console.log(result);
\`\`\`
`;
      fs.writeFileSync(readmePath, content);

      const result = extractTestPatternExamples(readmePath);
      expect(result.length).toBe(0);
    });
  });

  describe('extractCrossPackageTestDocs', () => {
    it('should return empty array when README does not exist', () => {
      const result = extractCrossPackageTestDocs(
        path.join(tempDir, 'nonexistent-README.md'),
        '@test/package'
      );
      expect(result).toEqual([]);
    });

    it('should extract cross-package test documentation', () => {
      const readmePath = path.join(tempDir, 'README.md');
      const content = `# Package

## Testing

### Cross-Package Testing

To test integration with @digitaldefiance/other-package, use the following approach.
`;
      fs.writeFileSync(readmePath, content);

      const result = extractCrossPackageTestDocs(readmePath, '@test/package');
      expect(result.length).toBeGreaterThan(0);

      // Find the entry with the package reference
      const entryWithPackage = result.find((r) => r.packages.length > 0);
      expect(entryWithPackage).toBeDefined();
      expect(entryWithPackage!.packages).toContain(
        '@digitaldefiance/other-package'
      );
    });

    it('should detect integration test mentions', () => {
      const readmePath = path.join(tempDir, 'README.md');
      const content = `# Package

## Testing

For integration testing across packages, ensure both packages are installed.
`;
      fs.writeFileSync(readmePath, content);

      const result = extractCrossPackageTestDocs(readmePath, '@test/package');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should not extract cross-package docs outside testing section', () => {
      const readmePath = path.join(tempDir, 'README.md');
      const content = `# Package

## Installation

Install @digitaldefiance/other-package as well.

## Testing

Run tests with npm test.
`;
      fs.writeFileSync(readmePath, content);

      const result = extractCrossPackageTestDocs(readmePath, '@test/package');
      // Should not find the installation mention
      expect(result.length).toBe(0);
    });
  });

  describe('hasCrossPackageDependencies', () => {
    it('should return false when package.json does not exist', () => {
      const result = hasCrossPackageDependencies(tempDir);
      expect(result).toBe(false);
    });

    it('should return true when package has Express Suite dependencies', () => {
      const packageJson = {
        name: '@test/package',
        dependencies: {
          '@digitaldefiance/other-package': '^1.0.0',
        },
      };
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      const result = hasCrossPackageDependencies(tempDir);
      expect(result).toBe(true);
    });

    it('should return true when package has Express Suite devDependencies', () => {
      const packageJson = {
        name: '@test/package',
        devDependencies: {
          '@express-suite/test-utils': '^1.0.0',
        },
      };
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      const result = hasCrossPackageDependencies(tempDir);
      expect(result).toBe(true);
    });

    it('should return false when package has no Express Suite dependencies', () => {
      const packageJson = {
        name: '@test/package',
        dependencies: {
          lodash: '^4.17.21',
        },
      };
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      const result = hasCrossPackageDependencies(tempDir);
      expect(result).toBe(false);
    });
  });

  describe('validateTestingApproach', () => {
    it('should return error when README is missing', () => {
      const packageJson = {
        name: '@test/package',
        version: '1.0.0',
      };
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      const result = validateTestingApproach(tempDir);
      expect(result.errors.some((e) => e.type === 'MissingReadme')).toBe(true);
    });

    it('should return error when testing section is missing', () => {
      const packageJson = {
        name: '@test/package',
        version: '1.0.0',
      };
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      fs.writeFileSync(
        path.join(tempDir, 'README.md'),
        '# Package\n\n## Installation'
      );

      const result = validateTestingApproach(tempDir);
      expect(
        result.errors.some((e) => e.type === 'MissingTestingSection')
      ).toBe(true);
    });

    it('should return error when test pattern examples are missing', () => {
      const packageJson = {
        name: '@test/package',
        version: '1.0.0',
      };
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      fs.writeFileSync(
        path.join(tempDir, 'README.md'),
        '# Package\n\n## Testing\n\nRun tests with npm test.'
      );

      const result = validateTestingApproach(tempDir);
      expect(
        result.errors.some((e) => e.type === 'MissingTestPatternExamples')
      ).toBe(true);
    });

    it('should return error when cross-package test docs are missing for packages with dependencies', () => {
      const packageJson = {
        name: '@test/package',
        version: '1.0.0',
        dependencies: {
          '@digitaldefiance/other-package': '^1.0.0',
        },
      };
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      fs.writeFileSync(
        path.join(tempDir, 'README.md'),
        `# Package

## Testing

\`\`\`typescript
test('works', () => {
  expect(true).toBe(true);
});
\`\`\`
`
      );

      const result = validateTestingApproach(tempDir);
      expect(
        result.errors.some((e) => e.type === 'MissingCrossPackageTestDocs')
      ).toBe(true);
    });

    it('should pass validation when all criteria are met', () => {
      const packageJson = {
        name: '@test/package',
        version: '1.0.0',
        dependencies: {
          '@digitaldefiance/other-package': '^1.0.0',
        },
      };
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      fs.writeFileSync(
        path.join(tempDir, 'README.md'),
        `# Package

## Testing

### Test Patterns

\`\`\`typescript
test('works', () => {
  expect(true).toBe(true);
});
\`\`\`

### Cross-Package Testing

To test integration with @digitaldefiance/other-package, use the following approach.
`
      );

      const result = validateTestingApproach(tempDir);
      expect(result.hasTestingSection).toBe(true);
      expect(result.hasTestPatternExamples).toBe(true);
      expect(result.hasCrossPackageTestDocs).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('getTestingApproachValidationSummary', () => {
    it('should calculate correct completeness score', () => {
      const result = {
        packageName: '@test/package',
        hasTestingSection: true,
        hasTestPatternExamples: true,
        hasCrossPackageTestDocs: false,
        testPatternExamples: [
          {
            pattern: 'test()',
            code: 'test("works", () => {})',
            location: { line: 5, column: 1 },
          },
        ],
        crossPackageTestDocs: [],
        errors: [],
      };

      const summary = getTestingApproachValidationSummary(result);
      expect(summary.hasTestingSection).toBe(true);
      expect(summary.testPatternExampleCount).toBe(1);
      expect(summary.crossPackageTestDocCount).toBe(0);
      expect(summary.completenessScore).toBe(100); // 2/2 criteria met (no cross-package needed)
    });

    it('should calculate score with cross-package requirement', () => {
      const result = {
        packageName: '@test/package',
        hasTestingSection: true,
        hasTestPatternExamples: true,
        hasCrossPackageTestDocs: false,
        testPatternExamples: [
          {
            pattern: 'test()',
            code: 'test("works", () => {})',
            location: { line: 5, column: 1 },
          },
        ],
        crossPackageTestDocs: [],
        errors: [
          {
            type: 'MissingCrossPackageTestDocs',
            severity: 'warning' as const,
            message: 'Missing cross-package test docs',
          },
        ],
      };

      const summary = getTestingApproachValidationSummary(result);
      expect(summary.completenessScore).toBeCloseTo(66.67, 1); // 2/3 criteria met
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 11: Testing Approach Documentation
     * For any package, the README should contain a section documenting the testing approach for that package.
     *
     * **Feature: documentation-and-coverage-audit, Property 11: Testing Approach Documentation**
     * **Validates: Requirements 5.2**
     */
    it('should validate that packages with tests have testing approach documentation', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasTestingSection: fc.boolean(),
            hasTestPatternExamples: fc.boolean(),
            hasCrossPackageDeps: fc.boolean(),
          }),
          (spec) => {
            // Create a temporary package
            const packagePath = fs.mkdtempSync(
              path.join(os.tmpdir(), 'pbt-testing-approach-')
            );

            try {
              // Create package.json
              const packageJson: any = {
                name: '@test/package',
                version: '1.0.0',
              };

              if (spec.hasCrossPackageDeps) {
                packageJson.dependencies = {
                  '@digitaldefiance/other-package': '^1.0.0',
                };
              }

              fs.writeFileSync(
                path.join(packagePath, 'package.json'),
                JSON.stringify(packageJson)
              );

              // Create README with appropriate sections
              let readmeContent = '# Test Package\n\n';

              if (spec.hasTestingSection) {
                readmeContent += '## Testing\n\n';
                readmeContent += 'This package uses Jest for testing.\n\n';

                if (spec.hasCrossPackageDeps) {
                  readmeContent +=
                    '### Cross-Package Testing\n\nTest integration with @digitaldefiance/other-package.\n';
                }
              }

              // Add test pattern examples (can be inside or outside testing section)
              if (spec.hasTestPatternExamples) {
                if (!spec.hasTestingSection) {
                  readmeContent += '## Usage\n\n';
                }
                readmeContent += '```typescript\n';
                readmeContent += 'test("example test", () => {\n';
                readmeContent += '  expect(true).toBe(true);\n';
                readmeContent += '});\n';
                readmeContent += '```\n\n';
              }

              fs.writeFileSync(
                path.join(packagePath, 'README.md'),
                readmeContent
              );

              // Validate
              const result = validateTestingApproach(packagePath);

              // Property: If package has testing section, it should be detected
              if (spec.hasTestingSection) {
                expect(result.hasTestingSection).toBe(true);
              } else {
                expect(result.hasTestingSection).toBe(false);
              }

              // Property: If package has test pattern examples, they should be detected
              if (spec.hasTestPatternExamples) {
                expect(result.hasTestPatternExamples).toBe(true);
              } else {
                expect(result.hasTestPatternExamples).toBe(false);
              }

              // Property: If package has cross-package deps and docs, they should be detected
              if (spec.hasCrossPackageDeps && spec.hasTestingSection) {
                // Should have cross-package test docs
                expect(result.hasCrossPackageTestDocs).toBe(true);
              }
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
     * Property 12: Test Pattern Examples
     * For any package with tests, the README should include at least one example of common test patterns used in that package.
     *
     * **Feature: documentation-and-coverage-audit, Property 12: Test Pattern Examples**
     * **Validates: Requirements 5.3**
     */
    it('should validate that packages with tests have test pattern examples', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              pattern: fc.constantFrom(
                'test()',
                'describe/it',
                'mock',
                'integration'
              ),
              hasExample: fc.boolean(),
            }),
            { minLength: 0, maxLength: 3 }
          ),
          (patterns) => {
            // Create a temporary package
            const packagePath = fs.mkdtempSync(
              path.join(os.tmpdir(), 'pbt-test-patterns-')
            );

            try {
              // Create package.json
              fs.writeFileSync(
                path.join(packagePath, 'package.json'),
                JSON.stringify({ name: '@test/package', version: '1.0.0' })
              );

              // Create README with test examples
              let readmeContent = '# Test Package\n\n## Testing\n\n';

              for (const patternSpec of patterns) {
                if (patternSpec.hasExample) {
                  readmeContent += '```typescript\n';
                  if (patternSpec.pattern === 'test()') {
                    readmeContent += 'test("example", () => {\n';
                    readmeContent += '  expect(true).toBe(true);\n';
                    readmeContent += '});\n';
                  } else if (patternSpec.pattern === 'describe/it') {
                    readmeContent += 'describe("suite", () => {\n';
                    readmeContent += '  it("works", () => {\n';
                    readmeContent += '    expect(true).toBe(true);\n';
                    readmeContent += '  });\n';
                    readmeContent += '});\n';
                  } else if (patternSpec.pattern === 'mock') {
                    readmeContent += 'const mockFn = jest.fn();\n';
                    readmeContent += 'test("mock", () => {\n';
                    readmeContent += '  mockFn();\n';
                    readmeContent += '  expect(mockFn).toHaveBeenCalled();\n';
                    readmeContent += '});\n';
                  } else if (patternSpec.pattern === 'integration') {
                    readmeContent += '// Integration test example\n';
                    readmeContent += 'test("integration", async () => {\n';
                    readmeContent += '  const result = await integration();\n';
                    readmeContent += '  expect(result).toBeDefined();\n';
                    readmeContent += '});\n';
                  }
                  readmeContent += '```\n\n';
                }
              }

              fs.writeFileSync(
                path.join(packagePath, 'README.md'),
                readmeContent
              );

              // Extract test pattern examples
              const examples = extractTestPatternExamples(
                path.join(packagePath, 'README.md')
              );

              // Property: Number of examples should match number of patterns with hasExample=true
              const expectedExampleCount = patterns.filter(
                (p) => p.hasExample
              ).length;
              expect(examples.length).toBe(expectedExampleCount);

              // Property: Each example should have a pattern identified
              for (const example of examples) {
                expect(example.pattern).toBeDefined();
                expect(example.pattern.length).toBeGreaterThan(0);
              }
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
     * Property 13: Cross-Package Test Documentation
     * For any package with cross-package dependencies, the README should document how to test functionality that spans packages.
     *
     * **Feature: documentation-and-coverage-audit, Property 13: Cross-Package Test Documentation**
     * **Validates: Requirements 5.4**
     */
    it('should validate that packages with cross-package dependencies have cross-package test documentation', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasCrossPackageDeps: fc.boolean(),
            hasCrossPackageTestDocs: fc.boolean(),
            packageCount: fc.integer({ min: 1, max: 3 }), // At least 1 package
          }),
          (spec) => {
            // Create a temporary package
            const packagePath = fs.mkdtempSync(
              path.join(os.tmpdir(), 'pbt-cross-package-')
            );

            try {
              // Create package.json
              const packageJson: any = {
                name: '@test/package',
                version: '1.0.0',
              };

              if (spec.hasCrossPackageDeps) {
                packageJson.dependencies = {};
                for (let i = 0; i < spec.packageCount; i++) {
                  packageJson.dependencies[`@digitaldefiance/package-${i}`] =
                    '^1.0.0';
                }
              }

              fs.writeFileSync(
                path.join(packagePath, 'package.json'),
                JSON.stringify(packageJson)
              );

              // Create README
              let readmeContent = '# Test Package\n\n## Testing\n\n';

              if (spec.hasCrossPackageTestDocs) {
                readmeContent += '### Cross-Package Testing\n\n';
                readmeContent +=
                  'To test integration with other packages, follow these steps:\n\n';

                for (let i = 0; i < spec.packageCount; i++) {
                  readmeContent += `- Test with @digitaldefiance/package-${i}\n`;
                }
              }

              fs.writeFileSync(
                path.join(packagePath, 'README.md'),
                readmeContent
              );

              // Check for cross-package dependencies
              const hasDeps = hasCrossPackageDependencies(packagePath);
              expect(hasDeps).toBe(spec.hasCrossPackageDeps);

              // Extract cross-package test docs
              const docs = extractCrossPackageTestDocs(
                path.join(packagePath, 'README.md'),
                '@test/package'
              );

              // Property: If package has cross-package test docs, they should be detected
              if (spec.hasCrossPackageTestDocs && spec.packageCount > 0) {
                expect(docs.length).toBeGreaterThan(0);
              }

              // Validate the package
              const result = validateTestingApproach(packagePath);

              // Property: If package has cross-package deps but no docs, should have error
              if (spec.hasCrossPackageDeps && !spec.hasCrossPackageTestDocs) {
                expect(
                  result.errors.some(
                    (e) => e.type === 'MissingCrossPackageTestDocs'
                  )
                ).toBe(true);
              }

              // Property: If package has cross-package deps and docs, should not have error
              if (spec.hasCrossPackageDeps && spec.hasCrossPackageTestDocs) {
                expect(
                  result.errors.some(
                    (e) => e.type === 'MissingCrossPackageTestDocs'
                  )
                ).toBe(false);
              }
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
     * Property: Validation should be deterministic
     */
    it('should produce consistent results across multiple validation runs', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasTestingSection: fc.boolean(),
            hasTestPatternExamples: fc.boolean(),
          }),
          (spec) => {
            const packagePath = fs.mkdtempSync(
              path.join(os.tmpdir(), 'pbt-deterministic-')
            );

            try {
              // Create package
              fs.writeFileSync(
                path.join(packagePath, 'package.json'),
                JSON.stringify({ name: '@test/package', version: '1.0.0' })
              );

              let readmeContent = '# Test Package\n\n';
              if (spec.hasTestingSection) {
                readmeContent += '## Testing\n\n';
                if (spec.hasTestPatternExamples) {
                  readmeContent += '```typescript\n';
                  readmeContent += 'test("example", () => {});\n';
                  readmeContent += '```\n';
                }
              }

              fs.writeFileSync(
                path.join(packagePath, 'README.md'),
                readmeContent
              );

              // Run validation multiple times
              const result1 = validateTestingApproach(packagePath);
              const result2 = validateTestingApproach(packagePath);
              const result3 = validateTestingApproach(packagePath);

              // Results should be identical
              expect(result1.hasTestingSection).toBe(result2.hasTestingSection);
              expect(result2.hasTestingSection).toBe(result3.hasTestingSection);

              expect(result1.hasTestPatternExamples).toBe(
                result2.hasTestPatternExamples
              );
              expect(result2.hasTestPatternExamples).toBe(
                result3.hasTestPatternExamples
              );

              expect(result1.errors.length).toBe(result2.errors.length);
              expect(result2.errors.length).toBe(result3.errors.length);
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
     * Property: Completeness score should be in valid range [0, 100]
     */
    it('should always produce valid completeness scores', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasTestingSection: fc.boolean(),
            hasTestPatternExamples: fc.boolean(),
            hasCrossPackageTestDocs: fc.boolean(),
            needsCrossPackageDocs: fc.boolean(),
          }),
          (spec) => {
            const result = {
              packageName: '@test/package',
              hasTestingSection: spec.hasTestingSection,
              hasTestPatternExamples: spec.hasTestPatternExamples,
              hasCrossPackageTestDocs: spec.hasCrossPackageTestDocs,
              testPatternExamples: [],
              crossPackageTestDocs: [],
              errors: spec.needsCrossPackageDocs
                ? [
                    {
                      type: 'MissingCrossPackageTestDocs',
                      severity: 'warning' as const,
                      message: 'Missing',
                    },
                  ]
                : [],
            };

            const summary = getTestingApproachValidationSummary(result);

            // Completeness score should be in valid range
            expect(summary.completenessScore).toBeGreaterThanOrEqual(0);
            expect(summary.completenessScore).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Adding documentation should never decrease completeness score
     */
    it('should have monotonic completeness score', () => {
      fc.assert(
        fc.property(
          fc.record({
            initialHasTestingSection: fc.boolean(),
            initialHasTestPatternExamples: fc.boolean(),
            addTestingSection: fc.boolean(),
            addTestPatternExamples: fc.boolean(),
          }),
          (spec) => {
            // Calculate initial score
            const result1 = {
              packageName: '@test/package',
              hasTestingSection: spec.initialHasTestingSection,
              hasTestPatternExamples: spec.initialHasTestPatternExamples,
              hasCrossPackageTestDocs: false,
              testPatternExamples: [],
              crossPackageTestDocs: [],
              errors: [],
            };

            const summary1 = getTestingApproachValidationSummary(result1);

            // Calculate score after adding documentation
            const result2 = {
              packageName: '@test/package',
              hasTestingSection:
                spec.initialHasTestingSection || spec.addTestingSection,
              hasTestPatternExamples:
                spec.initialHasTestPatternExamples ||
                spec.addTestPatternExamples,
              hasCrossPackageTestDocs: false,
              testPatternExamples: [],
              crossPackageTestDocs: [],
              errors: [],
            };

            const summary2 = getTestingApproachValidationSummary(result2);

            // Score should not decrease
            expect(summary2.completenessScore).toBeGreaterThanOrEqual(
              summary1.completenessScore
            );
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
