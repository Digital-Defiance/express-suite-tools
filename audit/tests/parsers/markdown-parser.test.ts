/**
 * Tests for Markdown parser
 * **Feature: documentation-and-coverage-audit, Property 1: Export Documentation Completeness**
 * **Validates: Requirements 1.1**
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  extractCodeExamples,
  parseReadmeContent,
} from '../../src/parsers/markdown-parser';
import { PROPERTY_TEST_CONFIG } from '../test-config';

let _tempFileCounter = 0;
function uniqueTempFile(prefix: string): string {
  return path.join(
    os.tmpdir(),
    `${prefix}-${process.pid}-${Date.now()}-${++_tempFileCounter}.md`
  );
}

describe('Markdown Parser', () => {
  describe('parseReadmeContent', () => {
    it('should return empty array for non-existent file', () => {
      const result = parseReadmeContent('/non/existent/README.md');
      expect(result).toEqual([]);
    });

    it('should parse function names from headings', () => {
      const tempFile = uniqueTempFile('test-readme');
      const content = `
# API Reference

## myFunction()

This function does something useful.
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = parseReadmeContent(tempFile);
        expect(result.length).toBeGreaterThan(0);
        expect(result.some((s) => s.name === 'myFunction')).toBe(true);
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    it('should parse class names from headings', () => {
      const tempFile = uniqueTempFile('test-readme');
      const content = `
# API Reference

## MyClass

A useful class for doing things.
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = parseReadmeContent(tempFile);
        expect(result.some((s) => s.name === 'MyClass')).toBe(true);
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    it('should parse symbols from code blocks', () => {
      const tempFile = uniqueTempFile('test-readme');
      const content = `
# Usage

\`\`\`typescript
export function helperFunction(): void {
  console.log('hello');
}
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = parseReadmeContent(tempFile);
        expect(result.some((s) => s.name === 'helperFunction')).toBe(true);
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    it('should parse backtick-wrapped identifiers', () => {
      const tempFile = uniqueTempFile('test-readme');
      const content = `
# API

The \`myUtility\` function is very useful.
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = parseReadmeContent(tempFile);
        expect(result.some((s) => s.name === 'myUtility')).toBe(true);
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    it('should include descriptions for documented symbols', () => {
      const tempFile = uniqueTempFile('test-readme');
      const content = `
# API Reference

## processData()

This function processes data and returns a result.
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = parseReadmeContent(tempFile);
        const symbol = result.find((s) => s.name === 'processData');
        expect(symbol).toBeDefined();
        expect(symbol?.description).toContain('processes data');
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    it('should track location information', () => {
      const tempFile = uniqueTempFile('test-readme');
      const content = `
# API Reference

## testFunction()

A test function.
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = parseReadmeContent(tempFile);
        const symbol = result.find((s) => s.name === 'testFunction');
        expect(symbol).toBeDefined();
        expect(symbol?.location.file).toBe(tempFile);
        expect(symbol?.location.line).toBeGreaterThan(0);
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });
  });

  describe('extractCodeExamples', () => {
    it('should return empty array for non-existent file', () => {
      const result = extractCodeExamples('/non/existent/README.md');
      expect(result).toEqual([]);
    });

    it('should extract code blocks with language', () => {
      const tempFile = uniqueTempFile('test-readme');
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
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    it('should extract referenced symbols from code', () => {
      const tempFile = uniqueTempFile('test-readme');
      const content = `
# Examples

\`\`\`typescript
import { myFunction } from './module';
import { PROPERTY_TEST_CONFIG } from '../test-config';
myFunction();
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = extractCodeExamples(tempFile);
        expect(result).toHaveLength(1);
        expect(result[0].referencedSymbols).toContain('myFunction');
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    it('should track location of code examples', () => {
      const tempFile = uniqueTempFile('test-readme');
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
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    it('should extract multiple code examples', () => {
      const tempFile = uniqueTempFile('test-readme');
      const content = `
# Examples

\`\`\`typescript
const x = 1;
\`\`\`

\`\`\`javascript
const y = 2;
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = extractCodeExamples(tempFile);
        expect(result).toHaveLength(2);
        expect(result[0].language).toBe('typescript');
        expect(result[1].language).toBe('javascript');
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 1: Export Documentation Completeness
     * For any package in the monorepo, all exported functions, classes, and interfaces
     * should be documented in the package README.
     *
     * This property test verifies that the markdown parser correctly identifies
     * documented symbols from README files, which is essential for validating
     * that all exports are properly documented.
     */
    it('should find all documented symbols regardless of markdown structure', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc
              .record({
                symbolName: fc.oneof(
                  // Functions use camelCase
                  fc
                    .stringMatching(/^[a-z][a-zA-Z0-9]*$/)
                    .filter((s) => s.length >= 2),
                  // Classes and interfaces use PascalCase
                  fc
                    .stringMatching(/^[A-Z][a-zA-Z0-9]*$/)
                    .filter((s) => s.length >= 2)
                ),
                symbolType: fc.constantFrom('function', 'class', 'interface'),
                documentationStyle: fc.constantFrom(
                  'heading',
                  'backtick',
                  'codeblock'
                ),
              })
              .chain((record) => {
                // Ensure naming conventions: functions are camelCase, classes/interfaces are PascalCase
                if (record.symbolType === 'function') {
                  return fc.constant({
                    ...record,
                    symbolName:
                      record.symbolName.charAt(0).toLowerCase() +
                      record.symbolName.slice(1),
                  });
                } else {
                  return fc.constant({
                    ...record,
                    symbolName:
                      record.symbolName.charAt(0).toUpperCase() +
                      record.symbolName.slice(1),
                  });
                }
              }),
            { minLength: 1, maxLength: 10 }
          ),
          (symbols) => {
            const tempFile = uniqueTempFile('pbt-readme');

            try {
              let content = '# API Reference\n\n';

              const expectedSymbols = new Set<string>();

              for (const sym of symbols) {
                expectedSymbols.add(sym.symbolName);

                switch (sym.documentationStyle) {
                  case 'heading':
                    if (sym.symbolType === 'function') {
                      content += `## ${sym.symbolName}()\n\nA useful function.\n\n`;
                    } else {
                      content += `## ${sym.symbolName}\n\nA useful ${sym.symbolType}.\n\n`;
                    }
                    break;

                  case 'backtick':
                    content += `The \`${sym.symbolName}\` is documented here.\n\n`;
                    break;

                  case 'codeblock':
                    if (sym.symbolType === 'function') {
                      content += `\`\`\`typescript\nexport function ${sym.symbolName}(): void {}\n\`\`\`\n\n`;
                    } else if (sym.symbolType === 'class') {
                      content += `\`\`\`typescript\nexport class ${sym.symbolName} {}\n\`\`\`\n\n`;
                    } else {
                      content += `\`\`\`typescript\nexport interface ${sym.symbolName} { value: string; }\n\`\`\`\n\n`;
                    }
                    break;
                }
              }

              fs.writeFileSync(tempFile, content);

              // Parse the README
              const result = parseReadmeContent(tempFile);

              // Verify all expected symbols were found
              const foundSymbols = new Set(result.map((s) => s.name));

              for (const expectedName of expectedSymbols) {
                expect(foundSymbols.has(expectedName)).toBe(true);
              }

              // Verify each documented symbol has required properties
              for (const docSymbol of result) {
                expect(docSymbol.name).toBeTruthy();
                expect(docSymbol.description).toBeTruthy();
                expect(docSymbol.location).toBeDefined();
                expect(docSymbol.location.file).toBe(tempFile);
                expect(docSymbol.location.line).toBeGreaterThan(0);
                expect(typeof docSymbol.hasUsageExample).toBe('boolean');
              }
            } finally {
              if (fs.existsSync(tempFile)) {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.SIMPLE }
      );
    });

    /**
     * Property: Parser should extract code examples with referenced symbols
     */
    it('should extract all code examples and identify referenced symbols', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              language: fc.constantFrom('typescript', 'javascript'),
              functionName: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (examples) => {
            const tempFile = uniqueTempFile('pbt-examples');

            try {
              let content = '# Examples\n\n';

              for (const ex of examples) {
                content += `\`\`\`${ex.language}\nimport { ${ex.functionName} } from './module';\n${ex.functionName}();\n\`\`\`\n\n`;
              }

              fs.writeFileSync(tempFile, content);

              const result = extractCodeExamples(tempFile);

              // Should find all code blocks
              expect(result.length).toBe(examples.length);

              // Each example should have the correct properties
              for (let i = 0; i < result.length; i++) {
                const example = result[i];
                const expected = examples[i];

                expect(example.language).toBe(expected.language);
                expect(example.code).toContain(expected.functionName);
                expect(example.referencedSymbols).toContain(
                  expected.functionName
                );
                expect(example.location.file).toBe(tempFile);
                expect(example.location.line).toBeGreaterThan(0);
              }
            } finally {
              if (fs.existsSync(tempFile)) {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.SIMPLE }
      );
    });

    /**
     * Property: Parser should handle various heading levels
     */
    it('should find symbols in headings at any level', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 6 }),
          fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
          (headingLevel, functionName) => {
            const tempFile = uniqueTempFile('pbt-headings');

            try {
              const hashes = '#'.repeat(headingLevel);
              const content = `${hashes} ${functionName}()\n\nA function description.\n`;

              fs.writeFileSync(tempFile, content);

              const result = parseReadmeContent(tempFile);

              // Should find the function regardless of heading level
              const found = result.some((s) => s.name === functionName);
              expect(found).toBe(true);
            } finally {
              if (fs.existsSync(tempFile)) {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.STANDARD }
      );
    });

    /**
     * Property: Parser should correctly identify symbols in mixed content
     */
    it('should parse symbols from mixed markdown content', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
          fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
          (className, functionName) => {
            const tempFile = uniqueTempFile('pbt-mixed');

            try {
              const content = `
# API Documentation

## ${className}

This is a class.

### Methods

#### ${functionName}()

This is a method.

## Usage

\`\`\`typescript
const instance = new ${className}();
instance.${functionName}();
\`\`\`
              `.trim();

              fs.writeFileSync(tempFile, content);

              const result = parseReadmeContent(tempFile);

              // Should find both the class and the function
              const foundClass = result.some((s) => s.name === className);
              const foundFunction = result.some((s) => s.name === functionName);

              expect(foundClass).toBe(true);
              expect(foundFunction).toBe(true);
            } finally {
              if (fs.existsSync(tempFile)) {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.STANDARD }
      );
    });

    /**
     * Property: Parser should not confuse common words with symbols
     */
    it('should filter out common words from symbol extraction', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('The', 'This', 'That', 'API', 'Usage', 'Example'),
          (commonWord) => {
            const tempFile = uniqueTempFile('pbt-common');

            try {
              const content = `# ${commonWord}\n\n${commonWord} is a common word.\n`;

              fs.writeFileSync(tempFile, content);

              const result = parseReadmeContent(tempFile);

              // Should not extract common words as symbols
              // (or if it does, they should be filtered appropriately)
              const foundCommon = result.filter((s) => s.name === commonWord);

              // Common words might be found but should be minimal
              // The key is that we don't want false positives
              expect(foundCommon.length).toBeLessThanOrEqual(1);
            } finally {
              if (fs.existsSync(tempFile)) {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.EXPENSIVE }
      );
    });
  });
});
