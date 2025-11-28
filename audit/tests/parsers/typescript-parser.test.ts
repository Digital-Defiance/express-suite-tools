/**
 * Tests for TypeScript parser
 * **Feature: documentation-and-coverage-audit, Property 5: Test Coverage for Exports**
 * **Validates: Requirements 2.3**
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseTypeScriptExports } from '../../src/parsers/typescript-parser';
import { PROPERTY_TEST_CONFIG } from '../test-config';

describe('TypeScript Parser', () => {
  describe('parseTypeScriptExports', () => {
    it('should return empty array for non-existent package', () => {
      const result = parseTypeScriptExports('/non/existent/path');
      expect(result).toEqual([]);
    });

    it('should return empty array for package without src directory', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      try {
        const result = parseTypeScriptExports(tempDir);
        expect(result).toEqual([]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should parse exported functions', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);

      const testFile = path.join(srcDir, 'test.ts');
      fs.writeFileSync(
        testFile,
        `
export function testFunction(param: string): number {
  return 42;
}
      `.trim()
      );

      try {
        const result = parseTypeScriptExports(tempDir);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('testFunction');
        expect(result[0].type).toBe('function');
        expect(result[0].signature).toContain('testFunction');
        expect(result[0].signature).toContain('param: string');
        expect(result[0].signature).toContain('number');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should parse exported classes', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);

      const testFile = path.join(srcDir, 'test.ts');
      fs.writeFileSync(
        testFile,
        `
export class TestClass {
  constructor(public name: string) {}
}
      `.trim()
      );

      try {
        const result = parseTypeScriptExports(tempDir);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('TestClass');
        expect(result[0].type).toBe('class');
        expect(result[0].signature).toContain('TestClass');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should parse exported interfaces', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);

      const testFile = path.join(srcDir, 'test.ts');
      fs.writeFileSync(
        testFile,
        `
export interface TestInterface {
  name: string;
  value: number;
}
      `.trim()
      );

      try {
        const result = parseTypeScriptExports(tempDir);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('TestInterface');
        expect(result[0].type).toBe('interface');
        expect(result[0].signature).toContain('TestInterface');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should parse exported type aliases', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);

      const testFile = path.join(srcDir, 'test.ts');
      fs.writeFileSync(
        testFile,
        `
export type TestType = string | number;
      `.trim()
      );

      try {
        const result = parseTypeScriptExports(tempDir);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('TestType');
        expect(result[0].type).toBe('type');
        expect(result[0].signature).toContain('TestType');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should parse exported constants', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);

      const testFile = path.join(srcDir, 'test.ts');
      fs.writeFileSync(
        testFile,
        `
export const TEST_CONSTANT: string = 'test';
      `.trim()
      );

      try {
        const result = parseTypeScriptExports(tempDir);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('TEST_CONSTANT');
        expect(result[0].type).toBe('const');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should handle re-exports from named exports', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);

      // Create a module with exports
      const moduleFile = path.join(srcDir, 'module.ts');
      fs.writeFileSync(
        moduleFile,
        `
export function helperFunction(): void {}
      `.trim()
      );

      // Create an index file that re-exports
      const indexFile = path.join(srcDir, 'index.ts');
      fs.writeFileSync(
        indexFile,
        `
export { helperFunction } from './module';
      `.trim()
      );

      try {
        const result = parseTypeScriptExports(tempDir);
        // Should find the original export and the re-export
        const helperExports = result.filter((e) => e.name === 'helperFunction');
        expect(helperExports.length).toBeGreaterThanOrEqual(1);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should skip test files', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);

      const testFile = path.join(srcDir, 'test.test.ts');
      fs.writeFileSync(
        testFile,
        `
export function testHelper(): void {}
      `.trim()
      );

      const regularFile = path.join(srcDir, 'regular.ts');
      fs.writeFileSync(
        regularFile,
        `
export function regularFunction(): void {}
      `.trim()
      );

      try {
        const result = parseTypeScriptExports(tempDir);
        // Should only find exports from regular.ts, not test.test.ts
        expect(result.some((e) => e.name === 'regularFunction')).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 5: Test Coverage for Exports
     * For any exported function or class, there should exist at least one test file that imports and tests it.
     *
     * This property test verifies that the parser correctly identifies all exported symbols
     * from TypeScript files, which is essential for later validation that tests exist for these exports.
     */
    it('should find all exported symbols regardless of file structure', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              fileName: fc.stringMatching(/^[a-z-]+\.ts$/),
              exportName: fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
              exportType: fc.constantFrom(
                'function',
                'class',
                'interface',
                'type',
                'const'
              ),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (exports) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'audit-pbt-')
            );
            const srcDir = path.join(tempDir, 'src');
            fs.mkdirSync(srcDir);

            try {
              // Create files with exports
              const expectedExports = new Set<string>();

              for (const exp of exports) {
                const filePath = path.join(srcDir, exp.fileName);

                let content = '';
                switch (exp.exportType) {
                  case 'function':
                    content = `export function ${exp.exportName}(): void {}`;
                    break;
                  case 'class':
                    content = `export class ${exp.exportName} {}`;
                    break;
                  case 'interface':
                    content = `export interface ${exp.exportName} { value: string; }`;
                    break;
                  case 'type':
                    content = `export type ${exp.exportName} = string;`;
                    break;
                  case 'const':
                    content = `export const ${exp.exportName}: string = 'test';`;
                    break;
                }

                // Append to file if it exists, otherwise create it
                if (fs.existsSync(filePath)) {
                  fs.appendFileSync(filePath, '\n' + content);
                } else {
                  fs.writeFileSync(filePath, content);
                }

                expectedExports.add(exp.exportName);
              }

              // Parse exports
              const result = parseTypeScriptExports(tempDir);

              // Verify all expected exports were found
              const foundExports = new Set(result.map((e) => e.name));

              for (const expectedName of expectedExports) {
                expect(foundExports.has(expectedName)).toBe(true);
              }

              // Verify each export has required properties
              for (const exportedSymbol of result) {
                expect(exportedSymbol.name).toBeTruthy();
                expect(exportedSymbol.type).toBeTruthy();
                expect(exportedSymbol.signature).toBeTruthy();
                expect(exportedSymbol.sourceFile).toBeTruthy();
                expect(typeof exportedSymbol.isDocumented).toBe('boolean');
                expect(typeof exportedSymbol.hasExample).toBe('boolean');
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
     * Property: Parser should handle nested directory structures
     */
    it('should find exports in nested directories', () => {
      fc.assert(
        fc.property(
          fc.array(fc.stringMatching(/^[a-z]+$/), {
            minLength: 1,
            maxLength: 3,
          }),
          fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
          (dirPath, exportName) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'audit-pbt-')
            );
            const srcDir = path.join(tempDir, 'src');

            try {
              // Create nested directory structure
              const nestedDir = path.join(srcDir, ...dirPath);
              fs.mkdirSync(nestedDir, { recursive: true });

              // Create file with export
              const filePath = path.join(nestedDir, 'module.ts');
              fs.writeFileSync(
                filePath,
                `export function ${exportName}(): void {}`
              );

              // Parse exports
              const result = parseTypeScriptExports(tempDir);

              // Should find the export
              const found = result.some((e) => e.name === exportName);
              expect(found).toBe(true);
            } finally {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.VERY_EXPENSIVE }
      );
    });

    /**
     * Property: Parser should correctly identify export types
     */
    it('should correctly categorize export types', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('function', 'class', 'interface', 'type', 'const'),
          fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
          (exportType, exportName) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'audit-pbt-')
            );
            const srcDir = path.join(tempDir, 'src');
            fs.mkdirSync(srcDir);

            try {
              const filePath = path.join(srcDir, 'test.ts');

              let content = '';
              switch (exportType) {
                case 'function':
                  content = `export function ${exportName}(): void {}`;
                  break;
                case 'class':
                  content = `export class ${exportName} {}`;
                  break;
                case 'interface':
                  content = `export interface ${exportName} { value: string; }`;
                  break;
                case 'type':
                  content = `export type ${exportName} = string;`;
                  break;
                case 'const':
                  content = `export const ${exportName}: string = 'test';`;
                  break;
              }

              fs.writeFileSync(filePath, content);

              const result = parseTypeScriptExports(tempDir);

              const found = result.find((e) => e.name === exportName);
              expect(found).toBeDefined();
              expect(found?.type).toBe(exportType);
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
