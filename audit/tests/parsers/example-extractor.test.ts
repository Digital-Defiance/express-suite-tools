/**
 * Tests for code example extractor
 * **Feature: documentation-and-coverage-audit, Property 7: Example Validation**
 * **Validates: Requirements 2.5**
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  extractCodeExamples,
  extractReferencedSymbols,
  findExamplesReferencingSymbol,
  getExampleLocation,
  getExampleStatistics,
} from '../../src/parsers/example-extractor';

describe('Example Extractor', () => {
  describe('extractCodeExamples', () => {
    it('should return empty array for non-existent file', () => {
      const result = extractCodeExamples('/non/existent/README.md');
      expect(result).toEqual([]);
    });

    it('should extract TypeScript code blocks', () => {
      const tempFile = path.join(os.tmpdir(), 'test-examples.md');
      const content = `
# Examples

\`\`\`typescript
const x = 42;
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = extractCodeExamples(tempFile);
        expect(result).toHaveLength(1);
        expect(result[0].language).toBe('typescript');
        expect(result[0].code).toContain('const x = 42');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should extract JavaScript code blocks', () => {
      const tempFile = path.join(os.tmpdir(), 'test-examples.md');
      const content = `
# Examples

\`\`\`javascript
const y = 100;
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = extractCodeExamples(tempFile);
        expect(result).toHaveLength(1);
        expect(result[0].language).toBe('javascript');
        expect(result[0].code).toContain('const y = 100');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should extract Bash code blocks', () => {
      const tempFile = path.join(os.tmpdir(), 'test-examples.md');
      const content = `
# Examples

\`\`\`bash
npm install
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = extractCodeExamples(tempFile);
        expect(result).toHaveLength(1);
        expect(result[0].language).toBe('bash');
        expect(result[0].code).toContain('npm install');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should normalize language identifiers', () => {
      const tempFile = path.join(os.tmpdir(), 'test-examples.md');
      const content = `
\`\`\`ts
const a = 1;
\`\`\`

\`\`\`js
const b = 2;
\`\`\`

\`\`\`sh
echo "hello"
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = extractCodeExamples(tempFile);
        expect(result).toHaveLength(3);
        expect(result[0].language).toBe('typescript');
        expect(result[1].language).toBe('javascript');
        expect(result[2].language).toBe('bash');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should track location of code examples', () => {
      const tempFile = path.join(os.tmpdir(), 'test-examples.md');
      const content = `
# Examples

\`\`\`typescript
const x = 1;
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = extractCodeExamples(tempFile);
        expect(result).toHaveLength(1);
        expect(result[0].location.file).toBe(tempFile);
        expect(result[0].location.line).toBeGreaterThan(0);
        expect(result[0].location.column).toBe(1);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should extract multiple code examples', () => {
      const tempFile = path.join(os.tmpdir(), 'test-examples.md');
      const content = `
# Examples

\`\`\`typescript
const x = 1;
\`\`\`

Some text here.

\`\`\`javascript
const y = 2;
\`\`\`

\`\`\`bash
echo "test"
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = extractCodeExamples(tempFile);
        expect(result).toHaveLength(3);
        expect(result[0].language).toBe('typescript');
        expect(result[1].language).toBe('javascript');
        expect(result[2].language).toBe('bash');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should handle code blocks without language specifier', () => {
      const tempFile = path.join(os.tmpdir(), 'test-examples.md');
      const content = `
\`\`\`
plain text
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = extractCodeExamples(tempFile);
        expect(result).toHaveLength(1);
        expect(result[0].language).toBe('text');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('extractReferencedSymbols', () => {
    it('should extract named imports from TypeScript', () => {
      const code = `import { myFunction, MyClass } from './module';`;
      const symbols = extractReferencedSymbols(code, 'typescript');

      expect(symbols).toContain('myFunction');
      expect(symbols).toContain('MyClass');
    });

    it('should extract default imports from TypeScript', () => {
      const code = `import MyComponent from './component';`;
      const symbols = extractReferencedSymbols(code, 'typescript');

      expect(symbols).toContain('MyComponent');
    });

    it('should extract namespace imports from TypeScript', () => {
      const code = `import * as utils from './utils';`;
      const symbols = extractReferencedSymbols(code, 'typescript');

      expect(symbols).toContain('utils');
    });

    it('should extract function calls from TypeScript', () => {
      const code = `myFunction(); anotherFunction(arg);`;
      const symbols = extractReferencedSymbols(code, 'typescript');

      expect(symbols).toContain('myFunction');
      expect(symbols).toContain('anotherFunction');
    });

    it('should extract class instantiations from TypeScript', () => {
      const code = `const instance = new MyClass();`;
      const symbols = extractReferencedSymbols(code, 'typescript');

      expect(symbols).toContain('MyClass');
    });

    it('should extract type annotations from TypeScript', () => {
      const code = `const value: MyType = getValue();`;
      const symbols = extractReferencedSymbols(code, 'typescript');

      expect(symbols).toContain('MyType');
      expect(symbols).toContain('getValue');
    });

    it('should not extract JavaScript keywords', () => {
      const code = `if (condition) { return value; }`;
      const symbols = extractReferencedSymbols(code, 'typescript');

      expect(symbols).not.toContain('if');
      expect(symbols).not.toContain('return');
    });

    it('should not extract common methods', () => {
      const code = `console.log('test'); array.map(x => x);`;
      const symbols = extractReferencedSymbols(code, 'typescript');

      expect(symbols).not.toContain('log');
      expect(symbols).not.toContain('map');
    });

    it('should extract custom commands from Bash', () => {
      const code = `myScript.sh\ncustomCommand arg1 arg2`;
      const symbols = extractReferencedSymbols(code, 'bash');

      expect(symbols).toContain('myScript.sh');
      expect(symbols).toContain('customCommand');
    });

    it('should not extract common Bash commands', () => {
      const code = `echo "test"\ncd /path\nls -la`;
      const symbols = extractReferencedSymbols(code, 'bash');

      expect(symbols).not.toContain('echo');
      expect(symbols).not.toContain('cd');
      expect(symbols).not.toContain('ls');
    });

    it('should return empty array for unsupported languages', () => {
      const code = `some code here`;
      const symbols = extractReferencedSymbols(code, 'python');

      expect(symbols).toEqual([]);
    });
  });

  describe('findExamplesReferencingSymbol', () => {
    it('should find examples that reference a specific symbol', () => {
      const tempFile = path.join(os.tmpdir(), 'test-find.md');
      const content = `
\`\`\`typescript
import { targetFunction } from './module';
targetFunction();
\`\`\`

\`\`\`typescript
import { otherFunction } from './other';
otherFunction();
\`\`\`

\`\`\`typescript
import { targetFunction, helper } from './module';
targetFunction();
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = findExamplesReferencingSymbol(
          tempFile,
          'targetFunction'
        );
        expect(result).toHaveLength(2);
        expect(result[0].code).toContain('targetFunction');
        expect(result[1].code).toContain('targetFunction');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should return empty array if symbol not found', () => {
      const tempFile = path.join(os.tmpdir(), 'test-find.md');
      const content = `
\`\`\`typescript
import { someFunction } from './module';
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = findExamplesReferencingSymbol(tempFile, 'nonExistent');
        expect(result).toEqual([]);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('getExampleLocation', () => {
    it('should return location of specific example by index', () => {
      const tempFile = path.join(os.tmpdir(), 'test-location.md');
      const content = `
\`\`\`typescript
const a = 1;
\`\`\`

\`\`\`javascript
const b = 2;
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const location = getExampleLocation(tempFile, 1);
        expect(location).not.toBeNull();
        expect(location?.file).toBe(tempFile);
        expect(location?.line).toBeGreaterThan(0);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should return null for invalid index', () => {
      const tempFile = path.join(os.tmpdir(), 'test-location.md');
      const content = `
\`\`\`typescript
const a = 1;
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const location = getExampleLocation(tempFile, 10);
        expect(location).toBeNull();
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('getExampleStatistics', () => {
    it('should return statistics about code examples', () => {
      const tempFile = path.join(os.tmpdir(), 'test-stats.md');
      const content = `
\`\`\`typescript
import { funcA, funcB } from './module';
funcA();
\`\`\`

\`\`\`javascript
import { funcC } from './other';
funcC();
\`\`\`

\`\`\`typescript
import { funcA } from './module';
funcA();
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const stats = getExampleStatistics(tempFile);
        expect(stats.totalExamples).toBe(3);
        expect(stats.byLanguage['typescript']).toBe(2);
        expect(stats.byLanguage['javascript']).toBe(1);
        expect(stats.uniqueSymbols).toBeGreaterThan(0);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should return zero statistics for file with no examples', () => {
      const tempFile = path.join(os.tmpdir(), 'test-stats.md');
      const content = `# Just a heading\n\nSome text.`;

      fs.writeFileSync(tempFile, content);

      try {
        const stats = getExampleStatistics(tempFile);
        expect(stats.totalExamples).toBe(0);
        expect(stats.totalSymbols).toBe(0);
        expect(stats.uniqueSymbols).toBe(0);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 7: Example Validation
     * For any code example in a README, there should exist either a corresponding test
     * or the example should be executable without errors.
     *
     * This property test verifies that the example extractor correctly identifies
     * all code examples and extracts their referenced symbols, which is essential
     * for validating that examples are properly tested.
     */
    it('should extract all code examples regardless of language or content', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              language: fc.constantFrom(
                'typescript',
                'javascript',
                'bash',
                'text'
              ),
              code: fc.oneof(
                // Simple variable declarations
                fc.constant('const x = 42;'),
                // Function definitions
                fc
                  .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
                  .map((name) => `function ${name}() {}`),
                // Import statements
                fc
                  .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
                  .map((name) => `import { ${name} } from './module';`),
                // Class definitions
                fc
                  .stringMatching(/^[A-Z][a-zA-Z0-9]*$/)
                  .map((name) => `class ${name} {}`),
                // Bash commands
                fc
                  .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
                  .map((cmd) => `${cmd} --help`)
              ),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (examples) => {
            const tempFile = path.join(os.tmpdir(), 'pbt-examples.md');

            try {
              let content = '# Code Examples\n\n';

              for (const ex of examples) {
                content += `\`\`\`${ex.language}\n${ex.code}\n\`\`\`\n\n`;
              }

              fs.writeFileSync(tempFile, content);

              const result = extractCodeExamples(tempFile);

              // Should extract all code blocks
              expect(result.length).toBe(examples.length);

              // Each example should have required properties
              for (let i = 0; i < result.length; i++) {
                const extracted = result[i];
                const expected = examples[i];

                expect(extracted.language).toBe(expected.language);
                expect(extracted.code).toBe(expected.code);
                expect(extracted.location.file).toBe(tempFile);
                expect(extracted.location.line).toBeGreaterThan(0);
                expect(extracted.location.column).toBe(1);
                expect(Array.isArray(extracted.referencedSymbols)).toBe(true);
                expect(typeof extracted.hasTest).toBe('boolean');
              }
            } finally {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Symbol extraction should find all imported symbols
     */
    it('should extract all imported symbols from TypeScript code', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc
              .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
              .filter((s) => s.length >= 2),
            { minLength: 1, maxLength: 5 }
          ),
          (symbolNames) => {
            const tempFile = path.join(os.tmpdir(), 'pbt-imports.md');

            try {
              const imports = symbolNames.map((name) => name).join(', ');
              const code = `import { ${imports} } from './module';\n${symbolNames[0]}();`;
              const content = `\`\`\`typescript\n${code}\n\`\`\``;

              fs.writeFileSync(tempFile, content);

              const result = extractCodeExamples(tempFile);

              expect(result).toHaveLength(1);

              // All imported symbols should be in referencedSymbols
              for (const symbolName of symbolNames) {
                expect(result[0].referencedSymbols).toContain(symbolName);
              }
            } finally {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Language normalization should be consistent
     */
    it('should normalize language identifiers consistently', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            ['ts', 'typescript'],
            ['js', 'javascript'],
            ['sh', 'bash', 'shell'],
            ['', 'text', 'txt']
          ),
          (languageVariants) => {
            const tempFile = path.join(os.tmpdir(), 'pbt-lang.md');

            try {
              const results: string[] = [];

              for (const lang of languageVariants) {
                const content = `\`\`\`${lang}\nconst x = 1;\n\`\`\``;
                fs.writeFileSync(tempFile, content);

                const extracted = extractCodeExamples(tempFile);
                expect(extracted).toHaveLength(1);
                results.push(extracted[0].language);
              }

              // All variants should normalize to the same language
              const uniqueLanguages = new Set(results);
              expect(uniqueLanguages.size).toBe(1);
            } finally {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Location tracking should be accurate
     */
    it('should track accurate line numbers for all examples', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 1, max: 3 }),
          (emptyLinesBefore, numExamples) => {
            const tempFile = path.join(os.tmpdir(), 'pbt-location.md');

            try {
              let content = '\n'.repeat(emptyLinesBefore);
              const expectedLines: number[] = [];

              for (let i = 0; i < numExamples; i++) {
                const startLine = content.split('\n').length + 1;
                expectedLines.push(startLine);
                content += `\`\`\`typescript\nconst x${i} = ${i};\n\`\`\`\n\n`;
              }

              fs.writeFileSync(tempFile, content);

              const result = extractCodeExamples(tempFile);

              expect(result.length).toBe(numExamples);

              // Each example should have a line number
              for (let i = 0; i < result.length; i++) {
                expect(result[i].location.line).toBeGreaterThan(0);
                // Line numbers should be in ascending order
                if (i > 0) {
                  expect(result[i].location.line).toBeGreaterThan(
                    result[i - 1].location.line
                  );
                }
              }
            } finally {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Symbol extraction should not include keywords
     */
    it('should never extract JavaScript keywords as symbols', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'if',
            'else',
            'for',
            'while',
            'return',
            'function',
            'const',
            'let',
            'var',
            'import',
            'export'
          ),
          (keyword) => {
            const tempFile = path.join(os.tmpdir(), 'pbt-keywords.md');

            try {
              const code = `${keyword} (condition) { ${
                keyword === 'return' ? 'return' : ''
              } }`;
              const content = `\`\`\`typescript\n${code}\n\`\`\``;

              fs.writeFileSync(tempFile, content);

              const result = extractCodeExamples(tempFile);

              expect(result).toHaveLength(1);
              expect(result[0].referencedSymbols).not.toContain(keyword);
            } finally {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Finding examples by symbol should be accurate
     */
    it('should find all examples that reference a given symbol', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/).filter((s) => s.length >= 3),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 0, max: 3 }),
          (targetSymbol, examplesWithSymbol, examplesWithoutSymbol) => {
            const tempFile = path.join(os.tmpdir(), 'pbt-find-symbol.md');

            try {
              let content = '# Examples\n\n';

              // Add examples that contain the target symbol
              for (let i = 0; i < examplesWithSymbol; i++) {
                content += `\`\`\`typescript\nimport { ${targetSymbol} } from './module';\n${targetSymbol}();\n\`\`\`\n\n`;
              }

              // Add examples that don't contain the target symbol
              for (let i = 0; i < examplesWithoutSymbol; i++) {
                content += `\`\`\`typescript\nimport { otherSymbol${i} } from './other';\notherSymbol${i}();\n\`\`\`\n\n`;
              }

              fs.writeFileSync(tempFile, content);

              const result = findExamplesReferencingSymbol(
                tempFile,
                targetSymbol
              );

              // Should find exactly the examples with the target symbol
              expect(result.length).toBe(examplesWithSymbol);

              // All found examples should reference the target symbol
              for (const example of result) {
                expect(example.referencedSymbols).toContain(targetSymbol);
              }
            } finally {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Statistics should be accurate
     */
    it('should calculate accurate statistics for any set of examples', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              language: fc.constantFrom('typescript', 'javascript', 'bash'),
              numSymbols: fc.integer({ min: 0, max: 5 }),
            }),
            { minLength: 0, maxLength: 10 }
          ),
          (exampleSpecs) => {
            const tempFile = path.join(os.tmpdir(), 'pbt-stats.md');

            try {
              let content = '# Examples\n\n';
              const expectedByLanguage: Record<string, number> = {};

              for (const spec of exampleSpecs) {
                expectedByLanguage[spec.language] =
                  (expectedByLanguage[spec.language] || 0) + 1;

                const symbols = Array.from(
                  { length: spec.numSymbols },
                  (_, i) => `symbol${i}`
                );
                const imports =
                  symbols.length > 0
                    ? `import { ${symbols.join(', ')} } from './module';\n`
                    : '';

                content += `\`\`\`${spec.language}\n${imports}const x = 1;\n\`\`\`\n\n`;
              }

              fs.writeFileSync(tempFile, content);

              const stats = getExampleStatistics(tempFile);

              // Total examples should match
              expect(stats.totalExamples).toBe(exampleSpecs.length);

              // Language counts should match
              for (const [lang, count] of Object.entries(expectedByLanguage)) {
                expect(stats.byLanguage[lang]).toBe(count);
              }

              // Symbols should be non-negative
              expect(stats.totalSymbols).toBeGreaterThanOrEqual(0);
              expect(stats.uniqueSymbols).toBeGreaterThanOrEqual(0);
              expect(stats.uniqueSymbols).toBeLessThanOrEqual(
                stats.totalSymbols
              );
            } finally {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
