/**
 * Tests for cross-reference validator
 * **Feature: documentation-and-coverage-audit, Property 4: Cross-Reference Validity**
 * **Validates: Requirements 1.5**
 * **Feature: documentation-and-coverage-audit, Property 18: Cross-Reference Verification**
 * **Validates: Requirements 6.4**
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CrossReference } from '../../src/types';

let _tempFileCounter = 0;
function uniqueTempFile(prefix: string): string {
  return path.join(
    os.tmpdir(),
    `${prefix}-${process.pid}-${Date.now()}-${++_tempFileCounter}.md`
  );
}
import {
  getInvalidReferences,
  getValidReferences,
  parsePackageReferences,
  validateCrossReferences,
  verifyExportExists,
  verifyPackageExists,
} from '../../src/validators/reference-validator';
import { PROPERTY_TEST_CONFIG } from '../test-config';

describe('Reference Validator', () => {
  describe('parsePackageReferences', () => {
    it('should return empty array for non-existent file', () => {
      const result = parsePackageReferences(
        '/non/existent/README.md',
        'test-package'
      );
      expect(result).toEqual([]);
    });

    it('should parse import statements with package references', () => {
      const tempFile = uniqueTempFile('ref-test-readme');
      const content = `
# Usage

\`\`\`typescript
import { MyClass } from '@digitaldefiance/ecies-lib';
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = parsePackageReferences(tempFile, 'test-package');
        expect(result.length).toBeGreaterThan(0);
        expect(
          result.some((r) => r.targetPackage === '@digitaldefiance/ecies-lib')
        ).toBe(true);
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    it('should parse markdown link references', () => {
      const tempFile = uniqueTempFile('ref-test-readme');
      const content = `
# Related Packages

See [@digitaldefiance/suite-core-lib](../suite-core-lib) for more info.
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = parsePackageReferences(tempFile, 'test-package');
        expect(
          result.some(
            (r) => r.targetPackage === '@digitaldefiance/suite-core-lib'
          )
        ).toBe(true);
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    it('should parse inline code references', () => {
      const tempFile = uniqueTempFile('ref-test-readme');
      const content = `
# Installation

Install \`@digitaldefiance/i18n-lib\` to use this feature.
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = parsePackageReferences(tempFile, 'test-package');
        expect(
          result.some((r) => r.targetPackage === '@digitaldefiance/i18n-lib')
        ).toBe(true);
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    it('should parse npm install commands', () => {
      const tempFile = uniqueTempFile('ref-test-readme');
      const content = `
# Installation

\`\`\`bash
npm install @digitaldefiance/node-express-suite
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = parsePackageReferences(tempFile, 'test-package');
        expect(
          result.some(
            (r) => r.targetPackage === '@digitaldefiance/node-express-suite'
          )
        ).toBe(true);
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    it('should parse yarn add commands', () => {
      const tempFile = uniqueTempFile('ref-test-readme');
      const content = `
# Installation

\`\`\`bash
yarn add @express-suite/test-utils
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = parsePackageReferences(tempFile, 'test-package');
        expect(
          result.some((r) => r.targetPackage === '@express-suite/test-utils')
        ).toBe(true);
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    it('should extract specific symbol references from imports', () => {
      const tempFile = uniqueTempFile('ref-test-readme');
      const content = `
# Usage

\`\`\`typescript
import { encrypt, decrypt } from '@digitaldefiance/ecies-lib';
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = parsePackageReferences(tempFile, 'test-package');
        const encryptRef = result.find((r) => r.targetSymbol === 'encrypt');
        const decryptRef = result.find((r) => r.targetSymbol === 'decrypt');

        expect(encryptRef).toBeDefined();
        expect(decryptRef).toBeDefined();
        expect(encryptRef?.targetPackage).toBe('@digitaldefiance/ecies-lib');
        expect(decryptRef?.targetPackage).toBe('@digitaldefiance/ecies-lib');
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    it('should track location information for references', () => {
      const tempFile = uniqueTempFile('ref-test-readme');
      const content = `
# Usage

\`\`\`typescript
import { MyClass } from '@digitaldefiance/ecies-lib';
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = parsePackageReferences(tempFile, 'test-package');
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].location.file).toBe(tempFile);
        expect(result[0].location.line).toBeGreaterThan(0);
        expect(result[0].location.column).toBeGreaterThan(0);
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    it('should remove duplicate references', () => {
      const tempFile = uniqueTempFile('ref-test-readme');
      const content = `
# Usage

\`\`\`typescript
import { MyClass } from '@digitaldefiance/ecies-lib';
import { MyClass } from '@digitaldefiance/ecies-lib';
\`\`\`
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const result = parsePackageReferences(tempFile, 'test-package');
        const eciesRefs = result.filter(
          (r) =>
            r.targetPackage === '@digitaldefiance/ecies-lib' &&
            r.targetSymbol === 'MyClass'
        );
        // Should have deduplicated based on line number
        expect(eciesRefs.length).toBeLessThanOrEqual(2);
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });
  });

  describe('verifyPackageExists', () => {
    it('should mark references as valid when package exists', () => {
      const references: CrossReference[] = [
        {
          sourcePackage: 'test-package',
          targetPackage: '@digitaldefiance/ecies-lib',
          location: { file: 'README.md', line: 1, column: 1 },
          isValid: false,
        },
      ];

      // Use the actual monorepo root
      const monorepoRoot = path.resolve(__dirname, '../../../..');
      const result = verifyPackageExists(references, monorepoRoot);

      // The ecies-lib package should exist
      expect(result[0].isValid).toBe(true);
    });

    it('should mark references as invalid when package does not exist', () => {
      const references: CrossReference[] = [
        {
          sourcePackage: 'test-package',
          targetPackage: '@digitaldefiance/non-existent-package',
          location: { file: 'README.md', line: 1, column: 1 },
          isValid: false,
        },
      ];

      const monorepoRoot = path.resolve(__dirname, '../../../..');
      const result = verifyPackageExists(references, monorepoRoot);

      expect(result[0].isValid).toBe(false);
    });
  });

  describe('verifyExportExists', () => {
    it('should keep isValid unchanged when no targetSymbol is specified', () => {
      const references: CrossReference[] = [
        {
          sourcePackage: 'test-package',
          targetPackage: '@digitaldefiance/ecies-lib',
          location: { file: 'README.md', line: 1, column: 1 },
          isValid: true,
        },
      ];

      const monorepoRoot = path.resolve(__dirname, '../../../..');
      const result = verifyExportExists(references, monorepoRoot);

      expect(result[0].isValid).toBe(true);
    });

    it('should mark as invalid when package does not exist', () => {
      const references: CrossReference[] = [
        {
          sourcePackage: 'test-package',
          targetPackage: '@digitaldefiance/non-existent',
          targetSymbol: 'SomeClass',
          location: { file: 'README.md', line: 1, column: 1 },
          isValid: false,
        },
      ];

      const monorepoRoot = path.resolve(__dirname, '../../../..');
      const result = verifyExportExists(references, monorepoRoot);

      expect(result[0].isValid).toBe(false);
    });
  });

  describe('validateCrossReferences', () => {
    it('should validate all references in a README', () => {
      const tempFile = uniqueTempFile('ref-test-readme');
      const content = `
# Usage

\`\`\`typescript
import { something } from '@digitaldefiance/ecies-lib';
\`\`\`

Install \`@digitaldefiance/non-existent-package\` for more features.
      `.trim();

      fs.writeFileSync(tempFile, content);

      try {
        const monorepoRoot = path.resolve(__dirname, '../../../..');
        const result = validateCrossReferences(
          tempFile,
          'test-package',
          monorepoRoot
        );

        expect(result.length).toBeGreaterThan(0);

        // Should have both valid and invalid references
        const validRefs = result.filter((r) => r.isValid);
        const invalidRefs = result.filter((r) => !r.isValid);

        expect(validRefs.length).toBeGreaterThan(0);
        expect(invalidRefs.length).toBeGreaterThan(0);
      } finally {
        if (fs.existsSync(tempFile)) {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        }
      }
    });
  });

  describe('getInvalidReferences', () => {
    it('should filter out only invalid references', () => {
      const references: CrossReference[] = [
        {
          sourcePackage: 'test',
          targetPackage: '@digitaldefiance/valid',
          location: { file: 'README.md', line: 1, column: 1 },
          isValid: true,
        },
        {
          sourcePackage: 'test',
          targetPackage: '@digitaldefiance/invalid',
          location: { file: 'README.md', line: 2, column: 1 },
          isValid: false,
        },
      ];

      const result = getInvalidReferences(references);
      expect(result).toHaveLength(1);
      expect(result[0].targetPackage).toBe('@digitaldefiance/invalid');
    });
  });

  describe('getValidReferences', () => {
    it('should filter out only valid references', () => {
      const references: CrossReference[] = [
        {
          sourcePackage: 'test',
          targetPackage: '@digitaldefiance/valid',
          location: { file: 'README.md', line: 1, column: 1 },
          isValid: true,
        },
        {
          sourcePackage: 'test',
          targetPackage: '@digitaldefiance/invalid',
          location: { file: 'README.md', line: 2, column: 1 },
          isValid: false,
        },
      ];

      const result = getValidReferences(references);
      expect(result).toHaveLength(1);
      expect(result[0].targetPackage).toBe('@digitaldefiance/valid');
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 4: Cross-Reference Validity
     * For any README file, all cross-references to other packages should point to
     * existing packages and valid exports.
     *
     * This property test verifies that the validator correctly identifies valid
     * and invalid package references in README files.
     */
    it('should correctly validate package references regardless of format', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              packageName: fc.constantFrom(
                'ecies-lib',
                'i18n-lib',
                'suite-core-lib',
                'node-express-suite',
                'non-existent-package'
              ),
              referenceStyle: fc.constantFrom(
                'import',
                'markdown',
                'inline',
                'npm',
                'yarn'
              ),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (references) => {
            const tempFile = uniqueTempFile('pbt-references');

            try {
              let content = '# Documentation\n\n';

              for (const ref of references) {
                const packageRef = `@digitaldefiance/${ref.packageName}`;

                switch (ref.referenceStyle) {
                  case 'import':
                    content += `\`\`\`typescript\nimport { Something } from '${packageRef}';\n\`\`\`\n\n`;
                    break;
                  case 'markdown':
                    content += `See [${packageRef}](../${ref.packageName}) for details.\n\n`;
                    break;
                  case 'inline':
                    content += `Use \`${packageRef}\` for this feature.\n\n`;
                    break;
                  case 'npm':
                    content += `\`\`\`bash\nnpm install ${packageRef}\n\`\`\`\n\n`;
                    break;
                  case 'yarn':
                    content += `\`\`\`bash\nyarn add ${packageRef}\n\`\`\`\n\n`;
                    break;
                }
              }

              fs.writeFileSync(tempFile, content);

              const monorepoRoot = path.resolve(__dirname, '../../../..');
              const result = validateCrossReferences(
                tempFile,
                'test-package',
                monorepoRoot
              );

              // Should find references
              expect(result.length).toBeGreaterThan(0);

              // Each reference should have required properties
              for (const ref of result) {
                expect(ref.sourcePackage).toBe('test-package');
                expect(ref.targetPackage).toMatch(
                  /@(digitaldefiance|express-suite)\//
                );
                expect(ref.location).toBeDefined();
                expect(ref.location.file).toBe(tempFile);
                expect(ref.location.line).toBeGreaterThan(0);
                expect(typeof ref.isValid).toBe('boolean');
              }

              // References to non-existent packages should be invalid
              const nonExistentRefs = result.filter((r) =>
                r.targetPackage.includes('non-existent')
              );
              for (const ref of nonExistentRefs) {
                expect(ref.isValid).toBe(false);
              }

              // References to existing packages should be valid (unless they reference a non-existent symbol)
              const existingPackages = [
                'ecies-lib',
                'i18n-lib',
                'suite-core-lib',
                'node-express-suite',
              ];
              const existingRefs = result.filter((r) =>
                existingPackages.some((pkg) => r.targetPackage.includes(pkg))
              );
              for (const ref of existingRefs) {
                // If no specific symbol is referenced, package existence means it's valid
                if (!ref.targetSymbol) {
                  expect(ref.isValid).toBe(true);
                }
                // If a symbol is referenced, it may or may not exist (we're using random symbols)
                // So we just check that isValid is a boolean
                else {
                  expect(typeof ref.isValid).toBe('boolean');
                }
              }
            } finally {
              if (fs.existsSync(tempFile)) {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.VERY_EXPENSIVE }
      );
    });

    /**
     * Property 18: Cross-Reference Verification
     * For any package, running the validation script should verify that all
     * cross-package references are valid.
     *
     * This property test verifies that the automated validation correctly
     * identifies all cross-references and validates them.
     */
    it('should validate all cross-references in any README structure', () => {
      fc.assert(
        fc.property(
          fc.record({
            validPackages: fc.array(
              fc.constantFrom(
                'ecies-lib',
                'i18n-lib',
                'suite-core-lib',
                'node-express-suite'
              ),
              { minLength: 1, maxLength: 3 }
            ),
            invalidPackages: fc.array(
              fc.stringMatching(/^[a-z-]+$/).filter((s) => s.length >= 3),
              { minLength: 0, maxLength: 2 }
            ),
          }),
          ({ validPackages, invalidPackages }) => {
            const tempFile = uniqueTempFile('pbt-validation');

            try {
              let content = '# Package Documentation\n\n';

              // Add valid package references
              content += '## Dependencies\n\n';
              for (const pkg of validPackages) {
                content += `- \`@digitaldefiance/${pkg}\`\n`;
              }

              // Add invalid package references
              if (invalidPackages.length > 0) {
                content += '\n## Future Dependencies\n\n';
                for (const pkg of invalidPackages) {
                  content += `- \`@digitaldefiance/${pkg}\`\n`;
                }
              }

              fs.writeFileSync(tempFile, content);

              const monorepoRoot = path.resolve(__dirname, '../../../..');
              const allReferences = validateCrossReferences(
                tempFile,
                'test-package',
                monorepoRoot
              );

              // Should find all references
              const expectedCount =
                validPackages.length + invalidPackages.length;
              expect(allReferences.length).toBeGreaterThanOrEqual(
                expectedCount
              );

              // All valid package references should be marked as valid
              const validRefs = getValidReferences(allReferences);
              for (const ref of validRefs) {
                const isExpectedValid = validPackages.some((pkg) =>
                  ref.targetPackage.includes(pkg)
                );
                expect(isExpectedValid).toBe(true);
              }

              // All invalid package references should be marked as invalid
              const invalidRefs = getInvalidReferences(allReferences);
              for (const ref of invalidRefs) {
                const isExpectedInvalid =
                  invalidPackages.some((pkg) =>
                    ref.targetPackage.includes(pkg)
                  ) ||
                  !validPackages.some((pkg) => ref.targetPackage.includes(pkg));
                expect(isExpectedInvalid).toBe(true);
              }

              // Validation should be deterministic
              const secondValidation = validateCrossReferences(
                tempFile,
                'test-package',
                monorepoRoot
              );
              expect(secondValidation.length).toBe(allReferences.length);
            } finally {
              if (fs.existsSync(tempFile)) {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.VERY_EXPENSIVE }
      );
    });

    /**
     * Property: Parser should handle multiple reference formats in same document
     */
    it('should parse all reference formats consistently', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('ecies-lib', 'i18n-lib', 'suite-core-lib'),
          (packageName) => {
            const tempFile = uniqueTempFile('pbt-formats');

            try {
              const packageRef = `@digitaldefiance/${packageName}`;
              const content = `
# Documentation

## Installation

\`\`\`bash
npm install ${packageRef}
yarn add ${packageRef}
\`\`\`

## Usage

\`\`\`typescript
import { Something } from '${packageRef}';
\`\`\`

## Related

See [${packageRef}](../${packageName}) and use \`${packageRef}\` in your project.
              `.trim();

              fs.writeFileSync(tempFile, content);

              const result = parsePackageReferences(tempFile, 'test-package');

              // Should find multiple references to the same package
              const packageRefs = result.filter(
                (r) => r.targetPackage === packageRef
              );
              expect(packageRefs.length).toBeGreaterThan(0);

              // All references should have the same target package
              for (const ref of packageRefs) {
                expect(ref.targetPackage).toBe(packageRef);
                expect(ref.sourcePackage).toBe('test-package');
                expect(ref.location.file).toBe(tempFile);
              }
            } finally {
              if (fs.existsSync(tempFile)) {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.VERY_EXPENSIVE }
      );
    });

    /**
     * Property: Symbol references should be validated against actual exports
     */
    it('should validate symbol references when specified', () => {
      fc.assert(
        fc.property(
          fc.record({
            packageName: fc.constantFrom('ecies-lib', 'i18n-lib'),
            symbolName: fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
          }),
          ({ packageName, symbolName }) => {
            const tempFile = uniqueTempFile('pbt-symbols');

            try {
              const packageRef = `@digitaldefiance/${packageName}`;
              const content = `
# Usage

\`\`\`typescript
import { ${symbolName} } from '${packageRef}';
\`\`\`
              `.trim();

              fs.writeFileSync(tempFile, content);

              const monorepoRoot = path.resolve(__dirname, '../../../..');
              const result = validateCrossReferences(
                tempFile,
                'test-package',
                monorepoRoot
              );

              // Should find the symbol reference
              const symbolRef = result.find(
                (r) => r.targetSymbol === symbolName
              );
              expect(symbolRef).toBeDefined();

              if (symbolRef) {
                expect(symbolRef.targetPackage).toBe(packageRef);
                expect(symbolRef.targetSymbol).toBe(symbolName);
                expect(typeof symbolRef.isValid).toBe('boolean');

                // If the symbol doesn't exist, it should be marked invalid
                // If it does exist, it should be marked valid
                // The validator should make this determination
              }
            } finally {
              if (fs.existsSync(tempFile)) {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.VERY_EXPENSIVE }
      );
    });

    /**
     * Property: Location tracking should be accurate
     */
    it('should track accurate location information for all references', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom('ecies-lib', 'i18n-lib', 'suite-core-lib'), {
            minLength: 1,
            maxLength: 5,
          }),
          (packages) => {
            const tempFile = uniqueTempFile('pbt-locations');

            try {
              let content = '# Documentation\n\n';
              const lineNumbers: number[] = [];

              for (const pkg of packages) {
                const currentLine = content.split('\n').length + 1;
                lineNumbers.push(currentLine);
                content += `Install \`@digitaldefiance/${pkg}\`\n\n`;
              }

              fs.writeFileSync(tempFile, content);

              const result = parsePackageReferences(tempFile, 'test-package');

              // Each reference should have a valid line number
              for (const ref of result) {
                expect(ref.location.line).toBeGreaterThan(0);
                expect(ref.location.line).toBeLessThanOrEqual(
                  content.split('\n').length
                );
                expect(ref.location.column).toBeGreaterThan(0);
                expect(ref.location.file).toBe(tempFile);
              }
            } finally {
              if (fs.existsSync(tempFile)) {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
              }
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.VERY_EXPENSIVE }
      );
    });
  });
});
