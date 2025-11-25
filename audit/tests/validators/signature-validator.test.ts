/**
 * Tests for API signature validator
 * **Feature: documentation-and-coverage-audit, Property 17: API Signature Verification**
 * **Validates: Requirements 6.3**
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  generateSignatureReport,
  getSignatureMismatches,
  validateApiSignatures,
} from '../../src/validators/signature-validator';

describe('Signature Validator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'signature-validator-test-')
    );
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper to create a test package
   */
  function createTestPackage(
    packageName: string,
    exports: Array<{ name: string; signature: string }>,
    documentedSignatures: Array<{ name: string; signature: string }>
  ): string {
    const packagePath = path.join(tempDir, packageName);
    fs.mkdirSync(packagePath, { recursive: true });

    // Create package.json
    fs.writeFileSync(
      path.join(packagePath, 'package.json'),
      JSON.stringify({ name: `@test/${packageName}`, version: '1.0.0' })
    );

    // Create src directory
    const srcDir = path.join(packagePath, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    // Create index.ts with exports
    let indexContent = '';
    for (const exp of exports) {
      indexContent += `${exp.signature}\n`;
    }
    fs.writeFileSync(path.join(srcDir, 'index.ts'), indexContent);

    // Create README with documented signatures
    let readmeContent = `# ${packageName}\n\n## API Reference\n\n`;
    for (const doc of documentedSignatures) {
      readmeContent += `### ${doc.name}\n\n`;
      readmeContent += `\`\`\`typescript\n${doc.signature}\n\`\`\`\n\n`;
    }
    fs.writeFileSync(path.join(packagePath, 'README.md'), readmeContent);

    return packagePath;
  }

  describe('validateApiSignatures', () => {
    it('should pass when signatures match', () => {
      const packagePath = createTestPackage(
        'matching-sigs',
        [
          {
            name: 'myFunction',
            signature: 'export function myFunction(): void {}',
          },
        ],
        [{ name: 'myFunction', signature: 'function myFunction(): void' }]
      );

      const result = validateApiSignatures(packagePath);

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when signatures mismatch', () => {
      const packagePath = createTestPackage(
        'mismatched-sigs',
        [
          {
            name: 'myFunction',
            signature: 'export function myFunction(x: number): string {}',
          },
        ],
        [{ name: 'myFunction', signature: 'function myFunction(): void' }]
      );

      const result = validateApiSignatures(packagePath);

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('OutdatedSignatureError');
    });

    it('should handle packages without README', () => {
      const packagePath = path.join(tempDir, 'no-readme');
      fs.mkdirSync(packagePath, { recursive: true });
      fs.writeFileSync(
        path.join(packagePath, 'package.json'),
        JSON.stringify({ name: '@test/no-readme' })
      );

      const srcDir = path.join(packagePath, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, 'index.ts'),
        'export function test() {}'
      );

      const result = validateApiSignatures(packagePath);

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about documented symbols not in exports', () => {
      const packagePath = createTestPackage(
        'extra-docs',
        [
          {
            name: 'realFunction',
            signature: 'export function realFunction() {}',
          },
        ],
        [
          { name: 'realFunction', signature: 'function realFunction()' },
          { name: 'fakeFunction', signature: 'function fakeFunction()' },
        ]
      );

      const result = validateApiSignatures(packagePath);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].type).toBe('OutdatedDocumentationWarning');
    });

    it('should handle symbols without documented signatures', () => {
      const packagePath = path.join(tempDir, 'no-sig-docs');
      fs.mkdirSync(packagePath, { recursive: true });
      fs.writeFileSync(
        path.join(packagePath, 'package.json'),
        JSON.stringify({ name: '@test/no-sig-docs' })
      );

      const srcDir = path.join(packagePath, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, 'index.ts'),
        'export function myFunc() {}'
      );

      // README with symbol but no signature
      fs.writeFileSync(
        path.join(packagePath, 'README.md'),
        '# Package\n\n### myFunc\n\nA function that does something.\n'
      );

      const result = validateApiSignatures(packagePath);

      // Should pass since no signature is documented
      expect(result.passed).toBe(true);
    });
  });

  describe('generateSignatureReport', () => {
    it('should generate readable report', () => {
      const packagePath = createTestPackage(
        'report-test',
        [
          {
            name: 'func1',
            signature: 'export function func1(x: number): string {}',
          },
        ],
        [{ name: 'func1', signature: 'function func1(): void' }]
      );

      const report = generateSignatureReport(packagePath);

      expect(report).toContain('API Signature Validation Report');
      expect(report).toContain('func1');
      expect(report).toContain('Signature Mismatches');
    });

    it('should show success when all signatures match', () => {
      const packagePath = createTestPackage(
        'all-match',
        [{ name: 'func', signature: 'export function func(): void {}' }],
        [{ name: 'func', signature: 'function func(): void' }]
      );

      const report = generateSignatureReport(packagePath);

      expect(report).toContain('All API signatures are up to date');
    });
  });

  describe('getSignatureMismatches', () => {
    it('should return array of mismatches', () => {
      const packagePath = createTestPackage(
        'mismatch-test',
        [
          {
            name: 'func1',
            signature: 'export function func1(x: number): string {}',
          },
          {
            name: 'func2',
            signature: 'export function func2(): void {}',
          },
        ],
        [
          { name: 'func1', signature: 'function func1(): void' },
          { name: 'func2', signature: 'function func2(): void' },
        ]
      );

      const mismatches = getSignatureMismatches(packagePath);

      expect(mismatches.length).toBeGreaterThan(0);
      expect(mismatches[0]).toHaveProperty('symbolName');
      expect(mismatches[0]).toHaveProperty('actual');
      expect(mismatches[0]).toHaveProperty('documented');
    });

    it('should return empty array when no mismatches', () => {
      const packagePath = createTestPackage(
        'no-mismatch',
        [{ name: 'func', signature: 'export function func(): void {}' }],
        [{ name: 'func', signature: 'function func(): void' }]
      );

      const mismatches = getSignatureMismatches(packagePath);

      expect(mismatches).toHaveLength(0);
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 17: API Signature Verification
     * For any package, running the validation script should verify that
     * README documentation matches current API signatures.
     */
    it('should correctly identify signature mismatches', () => {
      const testCases = [
        {
          name: 'all-match',
          exports: [
            { name: 'func1', signature: 'export function func1(): void {}' },
          ],
          documented: [{ name: 'func1', signature: 'function func1(): void' }],
          expectedErrors: 0,
        },
        {
          name: 'all-mismatch',
          exports: [
            {
              name: 'func1',
              signature: 'export function func1(x: number): string {}',
            },
          ],
          documented: [{ name: 'func1', signature: 'function func1(): void' }],
          expectedErrors: 1,
        },
        {
          name: 'mixed',
          exports: [
            { name: 'func1', signature: 'export function func1(): void {}' },
            {
              name: 'func2',
              signature: 'export function func2(x: number): string {}',
            },
          ],
          documented: [
            { name: 'func1', signature: 'function func1(): void' },
            { name: 'func2', signature: 'function func2(): void' },
          ],
          expectedErrors: 1,
        },
      ];

      for (const testCase of testCases) {
        const packagePath = createTestPackage(
          `pbt-${testCase.name}-${Date.now()}`,
          testCase.exports,
          testCase.documented
        );

        try {
          const result = validateApiSignatures(packagePath);
          const mismatches = getSignatureMismatches(packagePath);

          expect(result.errors.length).toBe(testCase.expectedErrors);
          expect(result.passed).toBe(testCase.expectedErrors === 0);
          expect(mismatches.length).toBe(testCase.expectedErrors);

          for (const error of result.errors) {
            expect(error.type).toBe('OutdatedSignatureError');
            expect(error.severity).toBe('critical');
            expect(error.message).toContain('signature mismatch');
            expect(error.recommendation).toBeDefined();
          }

          for (const mismatch of mismatches) {
            expect(mismatch.symbolName).toBeDefined();
            expect(mismatch.actual).toBeDefined();
            expect(mismatch.documented).toBeDefined();
          }
        } finally {
          if (fs.existsSync(packagePath)) {
            fs.rmSync(packagePath, { recursive: true, force: true });
          }
        }
      }
    });

    /**
     * Property: Validation should be deterministic
     */
    it('should produce consistent results across multiple runs', () => {
      const packagePath = createTestPackage(
        `pbt-deterministic-${Date.now()}`,
        [{ name: 'func', signature: 'export function func(): string {}' }],
        [{ name: 'func', signature: 'function func(): void' }]
      );

      try {
        const result1 = validateApiSignatures(packagePath);
        const result2 = validateApiSignatures(packagePath);
        const result3 = validateApiSignatures(packagePath);

        expect(result1.passed).toBe(result2.passed);
        expect(result2.passed).toBe(result3.passed);
        expect(result1.errors.length).toBe(result2.errors.length);
        expect(result2.errors.length).toBe(result3.errors.length);
      } finally {
        if (fs.existsSync(packagePath)) {
          fs.rmSync(packagePath, { recursive: true, force: true });
        }
      }
    });

    /**
     * Property: All errors should be actionable
     */
    it('should generate actionable error messages', () => {
      const packagePath = createTestPackage(
        `pbt-actionable-${Date.now()}`,
        [
          {
            name: 'func1',
            signature: 'export function func1(x: number): string {}',
          },
          {
            name: 'func2',
            signature: 'export function func2(y: boolean): number {}',
          },
        ],
        [
          { name: 'func1', signature: 'function func1(): void' },
          { name: 'func2', signature: 'function func2(): void' },
        ]
      );

      try {
        const result = validateApiSignatures(packagePath);

        expect(result.errors.length).toBeGreaterThan(0);

        for (const error of result.errors) {
          expect(error.message).toMatch(/'.+'/);
          expect(error.location).toBeDefined();
          expect(error.location).toContain('README.md');
          expect(error.recommendation).toBeDefined();
          expect(error.recommendation!.length).toBeGreaterThan(0);
          expect(error.recommendation).toContain('Actual:');
          expect(error.recommendation).toContain('Documented:');
          expect(error.severity).toBe('critical');
          expect(error.type).toBe('OutdatedSignatureError');
        }
      } finally {
        if (fs.existsSync(packagePath)) {
          fs.rmSync(packagePath, { recursive: true, force: true });
        }
      }
    });
  });
});
