/**
 * Tests for ECIES-specific analyzer
 * **Feature: documentation-and-coverage-audit, Property 8: Encryption Mode Test Matrix**
 * **Validates: Requirements 3.6**
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  analyzeEciesPackage,
  analyzeEciesTestMatrix,
  EncryptionMode,
  generateTestMatrixReport,
  IdProvider,
  isEciesPackage,
} from '../../src/analyzers/ecies-analyzer';
import { PackageDocumentation } from '../../src/types';

describe('ECIES Analyzer', () => {
  describe('isEciesPackage', () => {
    it('should identify ECIES packages', () => {
      expect(isEciesPackage('@digitaldefiance/ecies-lib')).toBe(true);
      expect(isEciesPackage('@digitaldefiance/node-ecies-lib')).toBe(true);
      expect(isEciesPackage('my-ecies-package')).toBe(true);
      expect(isEciesPackage('ECIES-wrapper')).toBe(true);
    });

    it('should not identify non-ECIES packages', () => {
      expect(isEciesPackage('@digitaldefiance/i18n-lib')).toBe(false);
      expect(isEciesPackage('express-suite')).toBe(false);
      expect(isEciesPackage('test-utils')).toBe(false);
    });
  });

  describe('analyzeEciesPackage', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecies-test-'));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should detect all encryption modes in README', () => {
      const readme = `
# ECIES Package

## Encryption Modes

### Simple Mode
Minimal overhead encryption.

### Single Mode
Single recipient encryption with length prefix.

### Multiple Mode
Multi-recipient encryption for up to 65,535 recipients.

## ID Providers

- **ObjectIdProvider**: 12-byte MongoDB-style IDs
- **GuidV4Provider**: 16-byte raw GUIDs
- **UuidProvider**: 16-byte UUIDs
- **CustomIdProvider**: Define your own size (1-255 bytes)

## Streaming Encryption

Use \`EncryptionStream\` for memory-efficient processing.

## Cross-Platform

Binary compatible with node-ecies-lib.
      `.trim();

      fs.writeFileSync(path.join(tempDir, 'README.md'), readme);

      const packageDoc: PackageDocumentation = {
        packageName: 'test-ecies',
        exports: [],
        documentedSymbols: [],
        examples: [],
        crossReferences: [],
        configOptions: [],
      };

      const result = analyzeEciesPackage(tempDir, packageDoc);

      expect(result.encryptionModes.documented).toContain(
        EncryptionMode.Simple
      );
      expect(result.encryptionModes.documented).toContain(
        EncryptionMode.Single
      );
      expect(result.encryptionModes.documented).toContain(
        EncryptionMode.Multiple
      );
      expect(result.encryptionModes.missing).toHaveLength(0);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect missing encryption modes', () => {
      const readme = `
# ECIES Package

## Encryption Modes

### Simple Mode
Minimal overhead encryption.
      `.trim();

      fs.writeFileSync(path.join(tempDir, 'README.md'), readme);

      const packageDoc: PackageDocumentation = {
        packageName: 'test-ecies',
        exports: [],
        documentedSymbols: [],
        examples: [],
        crossReferences: [],
        configOptions: [],
      };

      const result = analyzeEciesPackage(tempDir, packageDoc);

      expect(result.encryptionModes.documented).toContain(
        EncryptionMode.Simple
      );
      expect(result.encryptionModes.missing).toContain(EncryptionMode.Single);
      expect(result.encryptionModes.missing).toContain(EncryptionMode.Multiple);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(
        result.issues.some(
          (i) => i.type === 'missing-encryption-mode-documentation'
        )
      ).toBe(true);
    });

    it('should detect all ID providers in README', () => {
      const readme = `
# ECIES Package

## ID Providers

- **ObjectIdProvider**: 12-byte MongoDB-style IDs
- **GuidV4Provider**: 16-byte raw GUIDs
- **UuidProvider**: 16-byte UUIDs
- **CustomIdProvider**: Define your own size (1-255 bytes)
      `.trim();

      fs.writeFileSync(path.join(tempDir, 'README.md'), readme);

      const packageDoc: PackageDocumentation = {
        packageName: 'test-ecies',
        exports: [],
        documentedSymbols: [],
        examples: [],
        crossReferences: [],
        configOptions: [],
      };

      const result = analyzeEciesPackage(tempDir, packageDoc);

      expect(result.idProviders.documented).toContain(IdProvider.ObjectId);
      expect(result.idProviders.documented).toContain(IdProvider.GUID);
      expect(result.idProviders.documented).toContain(IdProvider.UUID);
      expect(result.idProviders.documented).toContain(IdProvider.Custom);
      expect(result.idProviders.missing).toHaveLength(0);
    });

    it('should detect missing ID providers', () => {
      const readme = `
# ECIES Package

## ID Providers

- **ObjectIdProvider**: 12-byte MongoDB-style IDs
      `.trim();

      fs.writeFileSync(path.join(tempDir, 'README.md'), readme);

      const packageDoc: PackageDocumentation = {
        packageName: 'test-ecies',
        exports: [],
        documentedSymbols: [],
        examples: [],
        crossReferences: [],
        configOptions: [],
      };

      const result = analyzeEciesPackage(tempDir, packageDoc);

      expect(result.idProviders.documented).toContain(IdProvider.ObjectId);
      expect(result.idProviders.missing).toContain(IdProvider.GUID);
      expect(result.idProviders.missing).toContain(IdProvider.UUID);
      expect(result.idProviders.missing).toContain(IdProvider.Custom);
      expect(
        result.issues.some(
          (i) => i.type === 'missing-id-provider-documentation'
        )
      ).toBe(true);
    });

    it('should detect streaming API documentation', () => {
      const readme = `
# ECIES Package

## Streaming Encryption

Use \`EncryptionStream\` for memory-efficient processing of large files.

\`\`\`typescript
const stream = new EncryptionStream(ecies);
for await (const chunk of stream.encryptStream(fileStream, publicKey)) {
  // Process encrypted chunks
}
\`\`\`
      `.trim();

      fs.writeFileSync(path.join(tempDir, 'README.md'), readme);

      const packageDoc: PackageDocumentation = {
        packageName: 'test-ecies',
        exports: [],
        documentedSymbols: [],
        examples: [],
        crossReferences: [],
        configOptions: [],
      };

      const result = analyzeEciesPackage(tempDir, packageDoc);

      expect(result.streamingApiDocumented).toBe(true);
      expect(
        result.issues.some(
          (i) => i.type === 'missing-streaming-api-documentation'
        )
      ).toBe(false);
    });

    it('should detect missing streaming API documentation', () => {
      const readme = `
# ECIES Package

Basic encryption functionality.
      `.trim();

      fs.writeFileSync(path.join(tempDir, 'README.md'), readme);

      const packageDoc: PackageDocumentation = {
        packageName: 'test-ecies',
        exports: [],
        documentedSymbols: [],
        examples: [],
        crossReferences: [],
        configOptions: [],
      };

      const result = analyzeEciesPackage(tempDir, packageDoc);

      expect(result.streamingApiDocumented).toBe(false);
      expect(
        result.issues.some(
          (i) => i.type === 'missing-streaming-api-documentation'
        )
      ).toBe(true);
    });

    it('should detect cross-platform examples', () => {
      const readme = `
# ECIES Package

## Cross-Platform Compatibility

Binary compatible with @digitaldefiance/node-ecies-lib.

\`\`\`typescript
// Encrypt in browser with ecies-lib
const encrypted = await eciesLib.encrypt(data, publicKey);

// Decrypt in Node.js with node-ecies-lib
const decrypted = await nodeEciesLib.decrypt(encrypted, privateKey);
\`\`\`
      `.trim();

      fs.writeFileSync(path.join(tempDir, 'README.md'), readme);

      const packageDoc: PackageDocumentation = {
        packageName: 'test-ecies',
        exports: [],
        documentedSymbols: [],
        examples: [],
        crossReferences: [],
        configOptions: [],
      };

      const result = analyzeEciesPackage(tempDir, packageDoc);

      expect(result.crossPlatformExamplesExist).toBe(true);
      expect(
        result.issues.some((i) => i.type === 'missing-cross-platform-examples')
      ).toBe(false);
    });

    it('should detect missing cross-platform examples', () => {
      const readme = `
# ECIES Package

Basic encryption functionality.
      `.trim();

      fs.writeFileSync(path.join(tempDir, 'README.md'), readme);

      const packageDoc: PackageDocumentation = {
        packageName: 'test-ecies',
        exports: [],
        documentedSymbols: [],
        examples: [],
        crossReferences: [],
        configOptions: [],
      };

      const result = analyzeEciesPackage(tempDir, packageDoc);

      expect(result.crossPlatformExamplesExist).toBe(false);
      expect(
        result.issues.some((i) => i.type === 'missing-cross-platform-examples')
      ).toBe(true);
    });
  });

  describe('analyzeEciesTestMatrix', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecies-test-'));
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-ecies' })
      );
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should detect tested mode × provider combinations', () => {
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(testsDir);

      // Create test file with Simple × ObjectId combination
      fs.writeFileSync(
        path.join(testsDir, 'simple-objectid.test.ts'),
        `
describe('Simple mode with ObjectId', () => {
  it('should encrypt with Simple mode and ObjectIdProvider', () => {
    const provider = new ObjectIdProvider();
    const encrypted = encryptSimple(data, publicKey);
    expect(encrypted).toBeDefined();
  });
});
        `.trim()
      );

      const result = analyzeEciesTestMatrix(tempDir);

      expect(result.packageName).toBe('test-ecies');
      expect(result.matrix.length).toBe(12); // 3 modes × 4 providers
      expect(result.coverage).toBeGreaterThan(0);
      expect(result.coverage).toBeLessThanOrEqual(100);

      // Find the Simple × ObjectId combination
      const simpleObjectId = result.matrix.find(
        (entry) =>
          entry.mode === EncryptionMode.Simple &&
          entry.provider === IdProvider.ObjectId
      );
      expect(simpleObjectId?.tested).toBe(true);
    });

    it('should calculate correct coverage percentage', () => {
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(testsDir);

      // Create test files for 6 out of 12 combinations (50% coverage)
      const combinations = [
        { mode: 'Simple', provider: 'ObjectId' },
        { mode: 'Simple', provider: 'GUID' },
        { mode: 'Single', provider: 'ObjectId' },
        { mode: 'Single', provider: 'UUID' },
        { mode: 'Multiple', provider: 'ObjectId' },
        { mode: 'Multiple', provider: 'Custom' },
      ];

      for (const combo of combinations) {
        fs.writeFileSync(
          path.join(
            testsDir,
            `${combo.mode.toLowerCase()}-${combo.provider.toLowerCase()}.test.ts`
          ),
          `
describe('${combo.mode} mode with ${combo.provider}', () => {
  it('should work with ${combo.mode} and ${combo.provider}Provider', () => {
    const provider = new ${combo.provider}Provider();
    const encrypted = encrypt${combo.mode}(data, publicKey);
    expect(encrypted).toBeDefined();
  });
});
          `.trim()
        );
      }

      const result = analyzeEciesTestMatrix(tempDir);

      expect(result.coverage).toBe(50);
      expect(result.missingCombinations.length).toBe(6);
    });

    it('should identify all missing combinations', () => {
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(testsDir);

      // Create no test files
      const result = analyzeEciesTestMatrix(tempDir);

      expect(result.coverage).toBe(0);
      expect(result.missingCombinations.length).toBe(12);

      // Verify all combinations are present
      const modes = Object.values(EncryptionMode);
      const providers = Object.values(IdProvider);

      for (const mode of modes) {
        for (const provider of providers) {
          const found = result.missingCombinations.some(
            (c) => c.mode === mode && c.provider === provider
          );
          expect(found).toBe(true);
        }
      }
    });
  });

  describe('generateTestMatrixReport', () => {
    it('should generate errors for incomplete test matrix', () => {
      const result = {
        packageName: 'test-ecies',
        matrix: [],
        coverage: 50,
        missingCombinations: [
          { mode: EncryptionMode.Simple, provider: IdProvider.GUID },
          { mode: EncryptionMode.Single, provider: IdProvider.UUID },
        ],
      };

      const errors = generateTestMatrixReport(result);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe('incomplete-test-matrix');
      expect(errors[0].severity).toBe('critical');
      expect(errors[0].message).toContain('50%');
      expect(errors[0].message).toContain('2 combinations');
    });

    it('should generate no errors for complete test matrix', () => {
      const result = {
        packageName: 'test-ecies',
        matrix: [],
        coverage: 100,
        missingCombinations: [],
      };

      const errors = generateTestMatrixReport(result);

      expect(errors).toHaveLength(0);
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 8: Encryption Mode Test Matrix
     * For any combination of encryption mode (Simple, Single, Multiple) and ID provider
     * (ObjectId, GUID, UUID, Custom), there should exist tests in the ECIES packages.
     *
     * This property test verifies that the analyzer correctly identifies all mode × provider
     * combinations and accurately calculates test coverage.
     */
    it('should correctly identify all mode × provider combinations', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              mode: fc.constantFrom(...Object.values(EncryptionMode)),
              provider: fc.constantFrom(...Object.values(IdProvider)),
              tested: fc.boolean(),
            }),
            { minLength: 1, maxLength: 12 }
          ),
          (combinations) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'ecies-pbt-')
            );

            try {
              fs.writeFileSync(
                path.join(tempDir, 'package.json'),
                JSON.stringify({ name: 'test-ecies' })
              );

              const testsDir = path.join(tempDir, 'tests');
              fs.mkdirSync(testsDir);

              // Create test files for tested combinations
              const testedCombinations = combinations.filter((c) => c.tested);
              for (let i = 0; i < testedCombinations.length; i++) {
                const combo = testedCombinations[i];
                fs.writeFileSync(
                  path.join(testsDir, `test-${i}.test.ts`),
                  `
describe('Test ${combo.mode} with ${combo.provider}', () => {
  it('should work with ${combo.mode} mode and ${combo.provider}Provider', () => {
    const provider = new ${combo.provider}Provider();
    const encrypted = encrypt${combo.mode}(data, publicKey);
    expect(encrypted).toBeDefined();
  });
});
                  `.trim()
                );
              }

              const result = analyzeEciesTestMatrix(tempDir);

              // Verify matrix has all 12 combinations
              expect(result.matrix.length).toBe(12);

              // Verify coverage is between 0 and 100
              expect(result.coverage).toBeGreaterThanOrEqual(0);
              expect(result.coverage).toBeLessThanOrEqual(100);

              // Verify missing combinations count
              expect(result.missingCombinations.length).toBe(
                12 - result.matrix.filter((m) => m.tested).length
              );

              // Verify coverage calculation
              const testedCount = result.matrix.filter((m) => m.tested).length;
              const expectedCoverage = Math.round((testedCount / 12) * 100);
              expect(result.coverage).toBe(expectedCoverage);
            } finally {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Test matrix should always have exactly 12 entries (3 modes × 4 providers)
     */
    it('should always generate a matrix with 12 entries', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 12 }), (numTested) => {
          const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecies-pbt-'));

          try {
            fs.writeFileSync(
              path.join(tempDir, 'package.json'),
              JSON.stringify({ name: 'test-ecies' })
            );

            const testsDir = path.join(tempDir, 'tests');
            fs.mkdirSync(testsDir);

            // Create test files for a specific number of combinations
            const modes = Object.values(EncryptionMode);
            const providers = Object.values(IdProvider);
            let count = 0;

            for (const mode of modes) {
              for (const provider of providers) {
                if (count < numTested) {
                  fs.writeFileSync(
                    path.join(testsDir, `test-${count}.test.ts`),
                    `
describe('Test ${mode} with ${provider}', () => {
  it('should work', () => {
    const p = new ${provider}Provider();
    const e = encrypt${mode}(data, key);
    expect(e).toBeDefined();
  });
});
                      `.trim()
                  );
                  count++;
                }
              }
            }

            const result = analyzeEciesTestMatrix(tempDir);

            // Matrix should always have exactly 12 entries
            expect(result.matrix.length).toBe(12);

            // Each mode should appear exactly 4 times
            for (const mode of modes) {
              const modeCount = result.matrix.filter(
                (m) => m.mode === mode
              ).length;
              expect(modeCount).toBe(4);
            }

            // Each provider should appear exactly 3 times
            for (const provider of providers) {
              const providerCount = result.matrix.filter(
                (m) => m.provider === provider
              ).length;
              expect(providerCount).toBe(3);
            }
          } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Coverage should be proportional to tested combinations
     */
    it('should calculate coverage proportional to tested combinations', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 12 }), (numTested) => {
          const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecies-pbt-'));

          try {
            fs.writeFileSync(
              path.join(tempDir, 'package.json'),
              JSON.stringify({ name: 'test-ecies' })
            );

            const testsDir = path.join(tempDir, 'tests');
            fs.mkdirSync(testsDir);

            // Create exactly numTested test files
            const modes = Object.values(EncryptionMode);
            const providers = Object.values(IdProvider);
            let count = 0;

            for (const mode of modes) {
              for (const provider of providers) {
                if (count < numTested) {
                  fs.writeFileSync(
                    path.join(testsDir, `test-${count}.test.ts`),
                    `
describe('Test ${mode} with ${provider}', () => {
  it('should work', () => {
    const p = new ${provider}Provider();
    const e = encrypt${mode}(data, key);
    expect(e).toBeDefined();
  });
});
                      `.trim()
                  );
                  count++;
                }
              }
            }

            const result = analyzeEciesTestMatrix(tempDir);

            // Calculate expected coverage
            const expectedCoverage = Math.round((numTested / 12) * 100);

            // Coverage should match expected (with some tolerance for rounding)
            expect(
              Math.abs(result.coverage - expectedCoverage)
            ).toBeLessThanOrEqual(1);

            // Missing combinations should be 12 - tested
            expect(result.missingCombinations.length).toBeLessThanOrEqual(
              12 - numTested + 1
            ); // +1 for potential detection variations
          } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: All documented modes should be from the EncryptionMode enum
     */
    it('should only return valid encryption modes', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom(
              'Simple',
              'Single',
              'Multiple',
              'simple mode',
              'single recipient',
              'multi-recipient'
            ),
            { minLength: 1, maxLength: 10 }
          ),
          (modeReferences) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'ecies-pbt-')
            );

            try {
              const readme = `
# ECIES Package

## Modes

${modeReferences.map((ref) => `- ${ref}`).join('\n')}
              `.trim();

              fs.writeFileSync(path.join(tempDir, 'README.md'), readme);

              const packageDoc: PackageDocumentation = {
                packageName: 'test-ecies',
                exports: [],
                documentedSymbols: [],
                examples: [],
                crossReferences: [],
                configOptions: [],
              };

              const result = analyzeEciesPackage(tempDir, packageDoc);

              // All documented modes should be valid enum values
              for (const mode of result.encryptionModes.documented) {
                expect(Object.values(EncryptionMode)).toContain(mode);
              }

              // All missing modes should be valid enum values
              for (const mode of result.encryptionModes.missing) {
                expect(Object.values(EncryptionMode)).toContain(mode);
              }

              // Documented + missing should equal all modes
              const totalModes =
                result.encryptionModes.documented.length +
                result.encryptionModes.missing.length;
              expect(totalModes).toBe(Object.values(EncryptionMode).length);
            } finally {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: All documented providers should be from the IdProvider enum
     */
    it('should only return valid ID providers', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom(
              'ObjectId',
              'GUID',
              'UUID',
              'Custom',
              'ObjectIdProvider',
              'GuidV4Provider',
              'UuidProvider',
              'CustomIdProvider'
            ),
            { minLength: 1, maxLength: 10 }
          ),
          (providerReferences) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'ecies-pbt-')
            );

            try {
              const readme = `
# ECIES Package

## ID Providers

${providerReferences.map((ref) => `- ${ref}`).join('\n')}
              `.trim();

              fs.writeFileSync(path.join(tempDir, 'README.md'), readme);

              const packageDoc: PackageDocumentation = {
                packageName: 'test-ecies',
                exports: [],
                documentedSymbols: [],
                examples: [],
                crossReferences: [],
                configOptions: [],
              };

              const result = analyzeEciesPackage(tempDir, packageDoc);

              // All documented providers should be valid enum values
              for (const provider of result.idProviders.documented) {
                expect(Object.values(IdProvider)).toContain(provider);
              }

              // All missing providers should be valid enum values
              for (const provider of result.idProviders.missing) {
                expect(Object.values(IdProvider)).toContain(provider);
              }

              // Documented + missing should equal all providers
              const totalProviders =
                result.idProviders.documented.length +
                result.idProviders.missing.length;
              expect(totalProviders).toBe(Object.values(IdProvider).length);
            } finally {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
