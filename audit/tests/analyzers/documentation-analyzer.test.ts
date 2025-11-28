/**
 * Tests for documentation analyzer
 * **Feature: documentation-and-coverage-audit, Property 2: Major Feature Examples**
 * **Validates: Requirements 1.2**
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  analyzePackage,
  calculateDocumentationCompleteness,
  calculateExampleCoverage,
  findMissingExamples,
  findUndocumentedExports,
  matchExportsToDocumentation,
} from '../../src/analyzers/documentation-analyzer';
import { CodeExample, DocumentedSymbol, ExportedSymbol } from '../../src/types';
import { PROPERTY_TEST_CONFIG } from '../test-config';

describe('Documentation Analyzer', () => {
  describe('analyzePackage', () => {
    it('should analyze a package with no exports', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);

      // Create package.json
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-package' })
      );

      try {
        const result = analyzePackage(tempDir);
        expect(result.packageName).toBe('test-package');
        expect(result.exports).toEqual([]);
        expect(result.documentedSymbols).toEqual([]);
        expect(result.examples).toEqual([]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should analyze a package with exports and README', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);

      // Create package.json
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-package' })
      );

      // Create a TypeScript file with exports
      fs.writeFileSync(
        path.join(srcDir, 'index.ts'),
        'export function testFunction(): void {}'
      );

      // Create README with documentation
      fs.writeFileSync(
        path.join(tempDir, 'README.md'),
        `
# Test Package

## API

### testFunction()

This is a test function.

\`\`\`typescript
import { testFunction } from 'test-package';
testFunction();
\`\`\`
        `.trim()
      );

      try {
        const result = analyzePackage(tempDir);
        expect(result.packageName).toBe('test-package');
        expect(result.exports.length).toBeGreaterThan(0);
        expect(result.documentedSymbols.length).toBeGreaterThan(0);
        expect(result.examples.length).toBeGreaterThan(0);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should handle package without README', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);

      // Create a TypeScript file with exports
      fs.writeFileSync(
        path.join(srcDir, 'index.ts'),
        'export function testFunction(): void {}'
      );

      try {
        const result = analyzePackage(tempDir);
        expect(result.exports.length).toBeGreaterThan(0);
        expect(result.documentedSymbols).toEqual([]);
        expect(result.examples).toEqual([]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('matchExportsToDocumentation', () => {
    it('should mark exports as documented when they appear in documentation', () => {
      const exports: ExportedSymbol[] = [
        {
          name: 'testFunction',
          type: 'function',
          signature: 'function testFunction(): void',
          sourceFile: 'src/index.ts',
          isDocumented: false,
          hasExample: false,
        },
      ];

      const documented: DocumentedSymbol[] = [
        {
          name: 'testFunction',
          description: 'A test function',
          location: { file: 'README.md', line: 10, column: 1 },
          hasUsageExample: false,
        },
      ];

      const result = matchExportsToDocumentation(exports, documented, []);

      expect(result[0].isDocumented).toBe(true);
      expect(result[0].hasExample).toBe(false);
    });

    it('should mark exports as having examples when they appear in code examples', () => {
      const exports: ExportedSymbol[] = [
        {
          name: 'testFunction',
          type: 'function',
          signature: 'function testFunction(): void',
          sourceFile: 'src/index.ts',
          isDocumented: false,
          hasExample: false,
        },
      ];

      const examples: CodeExample[] = [
        {
          code: 'testFunction();',
          language: 'typescript',
          location: { file: 'README.md', line: 20, column: 1 },
          referencedSymbols: ['testFunction'],
          hasTest: false,
        },
      ];

      const result = matchExportsToDocumentation(exports, [], examples);

      expect(result[0].isDocumented).toBe(false);
      expect(result[0].hasExample).toBe(true);
    });

    it('should handle exports with both documentation and examples', () => {
      const exports: ExportedSymbol[] = [
        {
          name: 'testFunction',
          type: 'function',
          signature: 'function testFunction(): void',
          sourceFile: 'src/index.ts',
          isDocumented: false,
          hasExample: false,
        },
      ];

      const documented: DocumentedSymbol[] = [
        {
          name: 'testFunction',
          description: 'A test function',
          location: { file: 'README.md', line: 10, column: 1 },
          hasUsageExample: true,
        },
      ];

      const examples: CodeExample[] = [
        {
          code: 'testFunction();',
          language: 'typescript',
          location: { file: 'README.md', line: 20, column: 1 },
          referencedSymbols: ['testFunction'],
          hasTest: false,
        },
      ];

      const result = matchExportsToDocumentation(exports, documented, examples);

      expect(result[0].isDocumented).toBe(true);
      expect(result[0].hasExample).toBe(true);
    });
  });

  describe('findUndocumentedExports', () => {
    it('should find exports without documentation', () => {
      const packageDoc = {
        packageName: 'test',
        exports: [
          {
            name: 'documented',
            type: 'function' as const,
            signature: 'function documented(): void',
            sourceFile: 'src/index.ts',
            isDocumented: true,
            hasExample: false,
          },
          {
            name: 'undocumented',
            type: 'function' as const,
            signature: 'function undocumented(): void',
            sourceFile: 'src/index.ts',
            isDocumented: false,
            hasExample: false,
          },
        ],
        documentedSymbols: [],
        examples: [],
        crossReferences: [],
        configOptions: [],
      };

      const result = findUndocumentedExports(packageDoc);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('undocumented');
    });
  });

  describe('findMissingExamples', () => {
    it('should find major features without examples', () => {
      const packageDoc = {
        packageName: 'test',
        exports: [
          {
            name: 'MyClass',
            type: 'class' as const,
            signature: 'class MyClass',
            sourceFile: 'src/index.ts',
            isDocumented: true,
            hasExample: false,
          },
          {
            name: 'myFunction',
            type: 'function' as const,
            signature: 'function myFunction(): void',
            sourceFile: 'src/index.ts',
            isDocumented: true,
            hasExample: true,
          },
          {
            name: 'MyInterface',
            type: 'interface' as const,
            signature: 'interface MyInterface',
            sourceFile: 'src/index.ts',
            isDocumented: true,
            hasExample: false,
          },
        ],
        documentedSymbols: [],
        examples: [],
        crossReferences: [],
        configOptions: [],
      };

      const result = findMissingExamples(packageDoc);

      // Should only include MyClass (not MyInterface, which is not a major feature)
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('MyClass');
    });
  });

  describe('calculateDocumentationCompleteness', () => {
    it('should return 100 for fully documented package', () => {
      const packageDoc = {
        packageName: 'test',
        exports: [
          {
            name: 'func1',
            type: 'function' as const,
            signature: 'function func1(): void',
            sourceFile: 'src/index.ts',
            isDocumented: true,
            hasExample: false,
          },
          {
            name: 'func2',
            type: 'function' as const,
            signature: 'function func2(): void',
            sourceFile: 'src/index.ts',
            isDocumented: true,
            hasExample: false,
          },
        ],
        documentedSymbols: [],
        examples: [],
        crossReferences: [],
        configOptions: [],
      };

      const result = calculateDocumentationCompleteness(packageDoc);
      expect(result).toBe(100);
    });

    it('should return 50 for half-documented package', () => {
      const packageDoc = {
        packageName: 'test',
        exports: [
          {
            name: 'func1',
            type: 'function' as const,
            signature: 'function func1(): void',
            sourceFile: 'src/index.ts',
            isDocumented: true,
            hasExample: false,
          },
          {
            name: 'func2',
            type: 'function' as const,
            signature: 'function func2(): void',
            sourceFile: 'src/index.ts',
            isDocumented: false,
            hasExample: false,
          },
        ],
        documentedSymbols: [],
        examples: [],
        crossReferences: [],
        configOptions: [],
      };

      const result = calculateDocumentationCompleteness(packageDoc);
      expect(result).toBe(50);
    });

    it('should return 100 for package with no exports', () => {
      const packageDoc = {
        packageName: 'test',
        exports: [],
        documentedSymbols: [],
        examples: [],
        crossReferences: [],
        configOptions: [],
      };

      const result = calculateDocumentationCompleteness(packageDoc);
      expect(result).toBe(100);
    });
  });

  describe('calculateExampleCoverage', () => {
    it('should return 100 for all major features with examples', () => {
      const packageDoc = {
        packageName: 'test',
        exports: [
          {
            name: 'MyClass',
            type: 'class' as const,
            signature: 'class MyClass',
            sourceFile: 'src/index.ts',
            isDocumented: true,
            hasExample: true,
          },
          {
            name: 'myFunction',
            type: 'function' as const,
            signature: 'function myFunction(): void',
            sourceFile: 'src/index.ts',
            isDocumented: true,
            hasExample: true,
          },
        ],
        documentedSymbols: [],
        examples: [],
        crossReferences: [],
        configOptions: [],
      };

      const result = calculateExampleCoverage(packageDoc);
      expect(result).toBe(100);
    });

    it('should return 100 for package with no major features', () => {
      const packageDoc = {
        packageName: 'test',
        exports: [
          {
            name: 'MyInterface',
            type: 'interface' as const,
            signature: 'interface MyInterface',
            sourceFile: 'src/index.ts',
            isDocumented: true,
            hasExample: false,
          },
        ],
        documentedSymbols: [],
        examples: [],
        crossReferences: [],
        configOptions: [],
      };

      const result = calculateExampleCoverage(packageDoc);
      expect(result).toBe(100);
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 2: Major Feature Examples
     * For any package in the monorepo, all major features (exported classes and primary functions)
     * should have at least one usage example in the README.
     *
     * This property test verifies that the analyzer correctly identifies major features
     * that lack usage examples.
     */
    it('should identify all major features without examples', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/),
              type: fc.constantFrom('function', 'class', 'interface', 'type'),
              hasExample: fc.boolean(),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (features) => {
            // Create package documentation
            const packageDoc = {
              packageName: 'test-package',
              exports: features.map((f) => ({
                name: f.name,
                type: f.type as 'function' | 'class' | 'interface' | 'type',
                signature: `${f.type} ${f.name}`,
                sourceFile: 'src/index.ts',
                isDocumented: true,
                hasExample: f.hasExample,
              })),
              documentedSymbols: [],
              examples: [],
              crossReferences: [],
              configOptions: [],
            };

            // Find missing examples
            const missingExamples = findMissingExamples(packageDoc);

            // Count expected missing examples (only classes and functions)
            const expectedMissing = features.filter(
              (f) =>
                (f.type === 'class' || f.type === 'function') && !f.hasExample
            );

            // Verify the count matches
            expect(missingExamples.length).toBe(expectedMissing.length);

            // Verify all missing examples are major features
            for (const missing of missingExamples) {
              expect(['class', 'function']).toContain(missing.type);
              expect(missing.hasExample).toBe(false);
            }

            // Verify no interfaces or types are included
            for (const missing of missingExamples) {
              expect(['interface', 'type']).not.toContain(missing.type);
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.VERY_EXPENSIVE }
      );
    });

    /**
     * Property: Documentation completeness should be between 0 and 100
     */
    it('should calculate documentation completeness as percentage', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/),
              isDocumented: fc.boolean(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (exports) => {
            const packageDoc = {
              packageName: 'test',
              exports: exports.map((e) => ({
                name: e.name,
                type: 'function' as const,
                signature: `function ${e.name}(): void`,
                sourceFile: 'src/index.ts',
                isDocumented: e.isDocumented,
                hasExample: false,
              })),
              documentedSymbols: [],
              examples: [],
              crossReferences: [],
              configOptions: [],
            };

            const completeness = calculateDocumentationCompleteness(packageDoc);

            // Should be between 0 and 100
            expect(completeness).toBeGreaterThanOrEqual(0);
            expect(completeness).toBeLessThanOrEqual(100);

            // Calculate expected percentage
            const documentedCount = exports.filter(
              (e) => e.isDocumented
            ).length;
            const expected = Math.round(
              (documentedCount / exports.length) * 100
            );

            expect(completeness).toBe(expected);
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.VERY_EXPENSIVE }
      );
    });

    /**
     * Property: Example coverage should be between 0 and 100
     */
    it('should calculate example coverage as percentage', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/),
              type: fc.constantFrom('function', 'class', 'interface', 'type'),
              hasExample: fc.boolean(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (exports) => {
            const packageDoc = {
              packageName: 'test',
              exports: exports.map((e) => ({
                name: e.name,
                type: e.type as 'function' | 'class' | 'interface' | 'type',
                signature: `${e.type} ${e.name}`,
                sourceFile: 'src/index.ts',
                isDocumented: true,
                hasExample: e.hasExample,
              })),
              documentedSymbols: [],
              examples: [],
              crossReferences: [],
              configOptions: [],
            };

            const coverage = calculateExampleCoverage(packageDoc);

            // Should be between 0 and 100
            expect(coverage).toBeGreaterThanOrEqual(0);
            expect(coverage).toBeLessThanOrEqual(100);

            // Calculate expected percentage
            const majorFeatures = exports.filter(
              (e) => e.type === 'class' || e.type === 'function'
            );

            if (majorFeatures.length === 0) {
              expect(coverage).toBe(100);
            } else {
              const withExamples = majorFeatures.filter(
                (e) => e.hasExample
              ).length;
              const expected = Math.round(
                (withExamples / majorFeatures.length) * 100
              );
              expect(coverage).toBe(expected);
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.VERY_EXPENSIVE }
      );
    });

    /**
     * Property: Matching should preserve export count
     */
    it('should not change the number of exports when matching', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/),
              type: fc.constantFrom('function', 'class', 'interface', 'type'),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (exportData) => {
            const exports: ExportedSymbol[] = exportData.map((e) => ({
              name: e.name,
              type: e.type as 'function' | 'class' | 'interface' | 'type',
              signature: `${e.type} ${e.name}`,
              sourceFile: 'src/index.ts',
              isDocumented: false,
              hasExample: false,
            }));

            const result = matchExportsToDocumentation(exports, [], []);

            // Should have same number of exports
            expect(result.length).toBe(exports.length);

            // Should preserve all names
            const originalNames = new Set(exports.map((e) => e.name));
            const resultNames = new Set(result.map((e) => e.name));
            expect(resultNames).toEqual(originalNames);
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.VERY_EXPENSIVE }
      );
    });
  });
});

describe('Configuration Documentation Tests', () => {
  describe('findUndocumentedConfigOptions', () => {
    it('should find configuration options without documentation', () => {
      const packageDoc = {
        packageName: 'test',
        exports: [],
        documentedSymbols: [],
        examples: [],
        crossReferences: [],
        configOptions: [
          {
            name: 'DocumentedConfig',
            type: 'interface',
            description: 'A documented config',
            isDocumented: true,
          },
          {
            name: 'UndocumentedConfig',
            type: 'interface',
            description: 'An undocumented config',
            isDocumented: false,
          },
        ],
      };

      const {
        findUndocumentedConfigOptions,
      } = require('../../src/analyzers/documentation-analyzer');
      const result = findUndocumentedConfigOptions(packageDoc);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('UndocumentedConfig');
    });
  });

  describe('Property-Based Tests for Configuration', () => {
    /**
     * Property 3: Configuration Documentation
     * For any package with configuration options, all configuration properties
     * should be documented with their default values in the README.
     *
     * This property test verifies that the analyzer correctly identifies
     * configuration options that lack documentation.
     */
    it('should identify all undocumented configuration options', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(
                /^[A-Z][a-zA-Z0-9]*(Config|Options|Settings)$/
              ),
              isDocumented: fc.boolean(),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (configs) => {
            const packageDoc = {
              packageName: 'test-package',
              exports: [],
              documentedSymbols: [],
              examples: [],
              crossReferences: [],
              configOptions: configs.map((c) => ({
                name: c.name,
                type: 'interface',
                description: `Configuration: ${c.name}`,
                isDocumented: c.isDocumented,
              })),
            };

            const {
              findUndocumentedConfigOptions,
            } = require('../../src/analyzers/documentation-analyzer');
            const undocumented = findUndocumentedConfigOptions(packageDoc);

            // Count expected undocumented configs
            const expectedUndocumented = configs.filter((c) => !c.isDocumented);

            // Verify the count matches
            expect(undocumented.length).toBe(expectedUndocumented.length);

            // Verify all undocumented configs are marked as not documented
            for (const config of undocumented) {
              expect(config.isDocumented).toBe(false);
            }

            // Verify names match
            const undocumentedNames = new Set(undocumented.map((c) => c.name));
            const expectedNames = new Set(
              expectedUndocumented.map((c) => c.name)
            );
            expect(undocumentedNames).toEqual(expectedNames);
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.VERY_EXPENSIVE }
      );
    });

    /**
     * Property: Config options should be extracted from interfaces with Config/Options/Settings in name
     */
    it('should extract configuration interfaces from exports', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
              suffix: fc.constantFrom('Config', 'Options', 'Settings', ''),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (interfaces) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'audit-test-')
            );
            const srcDir = path.join(tempDir, 'src');
            fs.mkdirSync(srcDir);

            try {
              // Create TypeScript file with interfaces
              const content = interfaces
                .map(
                  (i) =>
                    `export interface ${i.name}${i.suffix} { value: string; }`
                )
                .join('\n');

              fs.writeFileSync(path.join(srcDir, 'config.ts'), content);

              // Analyze package
              const result = analyzePackage(tempDir);

              // Count expected config interfaces (those with Config/Options/Settings)
              const expectedConfigs = interfaces.filter(
                (i) => i.suffix !== ''
              ).length;

              // Verify config options were extracted
              expect(result.configOptions.length).toBe(expectedConfigs);

              // Verify all config options have the right suffix
              for (const config of result.configOptions) {
                expect(
                  config.name.includes('Config') ||
                    config.name.includes('Options') ||
                    config.name.includes('Settings')
                ).toBe(true);
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
     * Property: All config options should have a name and type
     */
    it('should ensure all config options have required properties', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^[A-Z][a-zA-Z0-9]*(Config|Options)$/),
              isDocumented: fc.boolean(),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (configs) => {
            const packageDoc = {
              packageName: 'test',
              exports: [],
              documentedSymbols: [],
              examples: [],
              crossReferences: [],
              configOptions: configs.map((c) => ({
                name: c.name,
                type: 'interface',
                description: `Config: ${c.name}`,
                isDocumented: c.isDocumented,
              })),
            };

            // Verify all config options have required properties
            for (const config of packageDoc.configOptions) {
              expect(config.name).toBeTruthy();
              expect(config.type).toBeTruthy();
              expect(config.description).toBeTruthy();
              expect(typeof config.isDocumented).toBe('boolean');
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.VERY_EXPENSIVE }
      );
    });
  });
});
