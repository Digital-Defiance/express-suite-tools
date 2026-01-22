/**
 * Tests for ECIES test matrix validator
 * Validates ECIES test coverage including mode × provider combinations,
 * streaming tests, multi-recipient tests, and binary compatibility tests
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EncryptionMode, IdProvider } from '../../src/analyzers/ecies-analyzer';
import {
  generateEciesTestReport,
  validateEciesTests,
} from '../../src/validators/ecies-test-validator';
import { PROPERTY_TEST_CONFIG } from '../test-config';

describe('ECIES Test Validator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecies-test-validator-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('validateEciesTests', () => {
    it('should validate complete test coverage', () => {
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(testsDir);

      // Create tests for all mode × provider combinations
      const modes = Object.values(EncryptionMode);
      const providers = Object.values(IdProvider);

      for (const mode of modes) {
        for (const provider of providers) {
          fs.writeFileSync(
            path.join(
              testsDir,
              `${mode.toLowerCase()}-${provider.toLowerCase()}.test.ts`
            ),
            `
describe('${mode} mode with ${provider}', () => {
  it('should encrypt with ${mode} and ${provider}Provider', () => {
    const provider = new ${provider}Provider();
    const encrypted = encrypt${mode}(data, publicKey);
    expect(encrypted).toBeDefined();
  });
});
            `.trim()
          );
        }
      }

      // Add streaming tests
      fs.writeFileSync(
        path.join(testsDir, 'streaming.test.ts'),
        `
describe('Streaming encryption', () => {
  it('should encrypt with EncryptionStream', () => {
    const stream = new EncryptionStream(ecies);
    expect(stream).toBeDefined();
  });

  it('should handle large files', () => {
    const largeFile = Buffer.alloc(10 * 1024 * 1024); // 10 MB
    const encrypted = encryptStream(largeFile);
    expect(encrypted).toBeDefined();
  });
});
        `.trim()
      );

      // Add multi-recipient tests
      fs.writeFileSync(
        path.join(testsDir, 'multi-recipient.test.ts'),
        `
describe('Multi-recipient encryption', () => {
  it('should encrypt for multiple recipients', () => {
    const recipients = [publicKey1, publicKey2, publicKey3];
    const encrypted = encryptMultiple(data, recipients);
    expect(encrypted).toBeDefined();
  });
});
        `.trim()
      );

      // Add binary compatibility tests
      fs.writeFileSync(
        path.join(testsDir, 'binary-compatibility.test.ts'),
        `
import { encrypt } from '@digitaldefiance/ecies-lib';
import { decrypt } from '@digitaldefiance/node-ecies-lib';

describe('Binary compatibility', () => {
  it('should decrypt ecies-lib data with node-ecies-lib', () => {
    const encrypted = encrypt(data, publicKey);
    const decrypted = decrypt(encrypted, privateKey);
    expect(decrypted).toEqual(data);
  });
});
        `.trim()
      );

      const result = validateEciesTests(tempDir, 'test-ecies');

      expect(result.matrixCoverage.coverage).toBe(100);
      expect(result.streamingTests.hasStreamingTests).toBe(true);
      expect(result.streamingTests.hasLargeFileTests).toBe(true);
      expect(result.multiRecipientTests.hasMultiRecipientTests).toBe(true);
      expect(result.binaryCompatibilityTests.hasBinaryCompatibilityTests).toBe(
        true
      );
      expect(result.errors).toHaveLength(0);
    });

    it('should detect incomplete test matrix', () => {
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(testsDir);

      // Create only one test
      fs.writeFileSync(
        path.join(testsDir, 'simple-objectid.test.ts'),
        `
describe('Simple mode with ObjectId', () => {
  it('should encrypt', () => {
    const provider = new ObjectIdProvider();
    const encrypted = encryptSimple(data, publicKey);
    expect(encrypted).toBeDefined();
  });
});
        `.trim()
      );

      const result = validateEciesTests(tempDir, 'test-ecies');

      expect(result.matrixCoverage.coverage).toBeLessThan(100);
      expect(result.matrixCoverage.missingCombinations.length).toBeGreaterThan(
        0
      );
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((e) => e.type === 'incomplete-ecies-test-matrix')
      ).toBe(true);
    });

    it('should detect missing streaming tests', () => {
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(testsDir);

      // Create basic test without streaming
      fs.writeFileSync(
        path.join(testsDir, 'basic.test.ts'),
        `
describe('Basic encryption', () => {
  it('should encrypt', () => {
    const encrypted = encrypt(data, publicKey);
    expect(encrypted).toBeDefined();
  });
});
        `.trim()
      );

      const result = validateEciesTests(tempDir, 'test-ecies');

      expect(result.streamingTests.hasStreamingTests).toBe(false);
      expect(
        result.errors.some((e) => e.type === 'missing-streaming-tests')
      ).toBe(true);
    });

    it('should detect missing large file tests', () => {
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(testsDir);

      // Create streaming test without large file test
      fs.writeFileSync(
        path.join(testsDir, 'streaming.test.ts'),
        `
describe('Streaming encryption', () => {
  it('should encrypt with EncryptionStream', () => {
    const stream = new EncryptionStream(ecies);
    expect(stream).toBeDefined();
  });
});
        `.trim()
      );

      const result = validateEciesTests(tempDir, 'test-ecies');

      expect(result.streamingTests.hasStreamingTests).toBe(true);
      expect(result.streamingTests.hasLargeFileTests).toBe(false);
      expect(
        result.warnings.some((w) => w.type === 'missing-large-file-tests')
      ).toBe(true);
    });

    it('should detect missing multi-recipient tests', () => {
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(testsDir);

      // Create basic test without multi-recipient
      fs.writeFileSync(
        path.join(testsDir, 'basic.test.ts'),
        `
describe('Basic encryption', () => {
  it('should encrypt', () => {
    const encrypted = encrypt(data, publicKey);
    expect(encrypted).toBeDefined();
  });
});
        `.trim()
      );

      const result = validateEciesTests(tempDir, 'test-ecies');

      expect(result.multiRecipientTests.hasMultiRecipientTests).toBe(false);
      expect(
        result.errors.some((e) => e.type === 'missing-multi-recipient-tests')
      ).toBe(true);
    });

    it('should detect missing binary compatibility tests', () => {
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(testsDir);

      // Create basic test without binary compatibility
      fs.writeFileSync(
        path.join(testsDir, 'basic.test.ts'),
        `
describe('Basic encryption', () => {
  it('should encrypt', () => {
    const encrypted = encrypt(data, publicKey);
    expect(encrypted).toBeDefined();
  });
});
        `.trim()
      );

      const result = validateEciesTests(tempDir, 'test-ecies');

      expect(result.binaryCompatibilityTests.hasBinaryCompatibilityTests).toBe(
        false
      );
      expect(
        result.errors.some(
          (e) => e.type === 'missing-binary-compatibility-tests'
        )
      ).toBe(true);
    });

    it('should detect cross-package tests', () => {
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(testsDir);

      // Create test that imports from both packages
      fs.writeFileSync(
        path.join(testsDir, 'cross-package.test.ts'),
        `
import { encrypt } from '@digitaldefiance/ecies-lib';
import { decrypt } from '@digitaldefiance/node-ecies-lib';

describe('Cross-package compatibility', () => {
  it('should work across packages', () => {
    const encrypted = encrypt(data, publicKey);
    const decrypted = decrypt(encrypted, privateKey);
    expect(decrypted).toEqual(data);
  });
});
        `.trim()
      );

      const result = validateEciesTests(tempDir, 'test-ecies');

      expect(result.binaryCompatibilityTests.crossPackageTestsExist).toBe(true);
    });
  });

  describe('generateEciesTestReport', () => {
    it('should generate comprehensive report', () => {
      const result = {
        packageName: 'test-ecies',
        matrixCoverage: {
          totalCombinations: 12,
          testedCombinations: 6,
          coverage: 50,
          matrix: [],
          missingCombinations: [
            { mode: EncryptionMode.Basic, provider: IdProvider.GUID },
            { mode: EncryptionMode.WithLength, provider: IdProvider.UUID },
          ],
        },
        streamingTests: {
          hasStreamingTests: true,
          hasLargeFileTests: false,
          testFiles: ['streaming.test.ts'],
        },
        multiRecipientTests: {
          hasMultiRecipientTests: false,
          testFiles: [],
        },
        binaryCompatibilityTests: {
          hasBinaryCompatibilityTests: true,
          testFiles: ['compat.test.ts'],
          crossPackageTestsExist: true,
        },
        errors: [
          {
            type: 'incomplete-ecies-test-matrix',
            severity: 'critical' as const,
            message: 'Test matrix coverage is 50%',
            recommendation: 'Add missing tests',
          },
        ],
        warnings: [
          {
            type: 'missing-large-file-tests',
            severity: 'warning' as const,
            message: 'No large file tests',
            recommendation: 'Add large file tests',
          },
        ],
      };

      const report = generateEciesTestReport(result);

      expect(report).toContain('test-ecies');
      expect(report).toContain('50%');
      expect(report).toContain('Basic × GUID');
      expect(report).toContain('WithLength × UUID');
      expect(report).toContain('Has streaming tests: Yes');
      expect(report).toContain('Has large file tests: No');
      expect(report).toContain('Errors: 1');
      expect(report).toContain('Warnings: 1');
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property: Test matrix validation should always check all 12 combinations
     */
    it('should always validate all 12 mode × provider combinations', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 12 }), (numTested) => {
          const packagePath = fs.mkdtempSync(
            path.join(os.tmpdir(), 'pbt-matrix-')
          );

          try {
            const testsDir = path.join(packagePath, 'tests');
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

            const result = validateEciesTests(packagePath, 'test-package');

            // Should always check all 12 combinations
            expect(result.matrixCoverage.totalCombinations).toBe(12);
            expect(result.matrixCoverage.matrix.length).toBe(12);

            // Coverage should match tested count
            const expectedCoverage = Math.round((numTested / 12) * 100);
            expect(result.matrixCoverage.coverage).toBe(expectedCoverage);

            // Missing combinations should be 12 - tested
            expect(result.matrixCoverage.missingCombinations.length).toBe(
              12 - result.matrixCoverage.testedCombinations
            );
          } finally {
            fs.rmSync(packagePath, { recursive: true, force: true });
          }
        }),
        { numRuns: PROPERTY_TEST_CONFIG.SIMPLE }
      );
    });

    /**
     * Property: Streaming test detection should be consistent
     */
    it('should consistently detect streaming tests', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasStreamingKeyword: fc.boolean(),
            hasLargeFileKeyword: fc.boolean(),
          }),
          (testSpec) => {
            const packagePath = fs.mkdtempSync(
              path.join(os.tmpdir(), 'pbt-streaming-')
            );

            try {
              const testsDir = path.join(packagePath, 'tests');
              fs.mkdirSync(testsDir);

              let testContent = 'describe("Test", () => {';

              if (testSpec.hasStreamingKeyword) {
                testContent += '\n  it("should use EncryptionStream", () => {';
                testContent += '\n    const stream = new EncryptionStream();';
                testContent += '\n  });';
              }

              if (testSpec.hasLargeFileKeyword) {
                testContent +=
                  '\n  it("should handle large files of 100 MB", () => {';
                testContent += '\n    const largeFile = Buffer.alloc(100);';
                testContent += '\n  });';
              }

              testContent += '\n});';

              fs.writeFileSync(
                path.join(testsDir, 'test.test.ts'),
                testContent
              );

              const result = validateEciesTests(packagePath, 'test-package');

              // Streaming tests should be detected if keyword present
              expect(result.streamingTests.hasStreamingTests).toBe(
                testSpec.hasStreamingKeyword
              );

              // Large file tests should be detected if keyword present
              if (testSpec.hasStreamingKeyword) {
                expect(result.streamingTests.hasLargeFileTests).toBe(
                  testSpec.hasLargeFileKeyword
                );
              }
            } finally {
              fs.rmSync(packagePath, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.SIMPLE }
      );
    });

    /**
     * Property: Multi-recipient test detection should be consistent
     */
    it('should consistently detect multi-recipient tests', () => {
      fc.assert(
        fc.property(fc.boolean(), (hasMultiRecipient) => {
          const packagePath = fs.mkdtempSync(
            path.join(os.tmpdir(), 'pbt-multi-')
          );

          try {
            const testsDir = path.join(packagePath, 'tests');
            fs.mkdirSync(testsDir);

            let testContent = 'describe("Test", () => {';

            if (hasMultiRecipient) {
              testContent +=
                '\n  it("should encrypt for multiple recipients", () => {';
              testContent += '\n    const recipients = [key1, key2, key3];';
              testContent +=
                '\n    const encrypted = encryptMultiple(data, recipients);';
              testContent += '\n  });';
            } else {
              testContent += '\n  it("should encrypt", () => {';
              testContent += '\n    const encrypted = encrypt(data, key);';
              testContent += '\n  });';
            }

            testContent += '\n});';

            fs.writeFileSync(path.join(testsDir, 'test.test.ts'), testContent);

            const result = validateEciesTests(packagePath, 'test-package');

            expect(result.multiRecipientTests.hasMultiRecipientTests).toBe(
              hasMultiRecipient
            );
          } finally {
            fs.rmSync(packagePath, { recursive: true, force: true });
          }
        }),
        { numRuns: PROPERTY_TEST_CONFIG.SIMPLE }
      );
    });

    /**
     * Property: Binary compatibility test detection should be consistent
     */
    it('should consistently detect binary compatibility tests', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasBinaryKeyword: fc.boolean(),
            hasCrossPackageImports: fc.boolean(),
          }),
          (testSpec) => {
            const packagePath = fs.mkdtempSync(
              path.join(os.tmpdir(), 'pbt-binary-')
            );

            try {
              const testsDir = path.join(packagePath, 'tests');
              fs.mkdirSync(testsDir);

              let testContent = '';

              if (testSpec.hasCrossPackageImports) {
                testContent +=
                  'import { encrypt } from "@digitaldefiance/ecies-lib";\n';
                testContent +=
                  'import { decrypt } from "@digitaldefiance/node-ecies-lib";\n\n';
              }

              testContent += 'describe("Test", () => {';

              if (testSpec.hasBinaryKeyword) {
                testContent +=
                  '\n  it("should test binary compatibility", () => {';
                testContent += '\n    const encrypted = encrypt(data, key);';
                testContent += '\n    const decrypted = decrypt(encrypted);';
                testContent += '\n  });';
              } else {
                testContent += '\n  it("should encrypt", () => {';
                testContent += '\n    const encrypted = encrypt(data, key);';
                testContent += '\n  });';
              }

              testContent += '\n});';

              fs.writeFileSync(
                path.join(testsDir, 'test.test.ts'),
                testContent
              );

              const result = validateEciesTests(packagePath, 'test-package');

              // Should detect binary compatibility if keyword present
              expect(
                result.binaryCompatibilityTests.hasBinaryCompatibilityTests
              ).toBe(testSpec.hasBinaryKeyword);

              // Should detect cross-package tests if imports present
              expect(
                result.binaryCompatibilityTests.crossPackageTestsExist
              ).toBe(testSpec.hasCrossPackageImports);
            } finally {
              fs.rmSync(packagePath, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.SIMPLE }
      );
    });

    /**
     * Property: Validation should generate errors for incomplete coverage
     */
    it('should generate errors when coverage is incomplete', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 11 }), (numTested) => {
          const packagePath = fs.mkdtempSync(
            path.join(os.tmpdir(), 'pbt-errors-')
          );

          try {
            const testsDir = path.join(packagePath, 'tests');
            fs.mkdirSync(testsDir);

            // Create numTested test files (less than 12)
            // Use generic test content to avoid accidentally triggering other validators
            const modes = Object.values(EncryptionMode);
            const providers = Object.values(IdProvider);
            let count = 0;

            for (const mode of modes) {
              for (const provider of providers) {
                if (count < numTested) {
                  fs.writeFileSync(
                    path.join(testsDir, `test-${count}.test.ts`),
                    `
describe('Test mode ${count} with provider ${count}', () => {
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

            const result = validateEciesTests(packagePath, 'test-package');

            // Should have error for incomplete matrix
            expect(result.errors.length).toBeGreaterThan(0);
            expect(
              result.errors.some(
                (e) => e.type === 'incomplete-ecies-test-matrix'
              )
            ).toBe(true);

            // Should have error for missing streaming tests
            expect(
              result.errors.some((e) => e.type === 'missing-streaming-tests')
            ).toBe(true);
          } finally {
            fs.rmSync(packagePath, { recursive: true, force: true });
          }
        }),
        { numRuns: PROPERTY_TEST_CONFIG.STANDARD }
      );
    });

    /**
     * Property: Validation should not generate errors for complete coverage
     */
    it('should not generate errors when all tests are present', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const packagePath = fs.mkdtempSync(
            path.join(os.tmpdir(), 'pbt-complete-')
          );

          try {
            const testsDir = path.join(packagePath, 'tests');
            fs.mkdirSync(testsDir);

            // Create all 12 mode × provider tests
            const modes = Object.values(EncryptionMode);
            const providers = Object.values(IdProvider);
            let count = 0;

            for (const mode of modes) {
              for (const provider of providers) {
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

            // Add streaming tests
            fs.writeFileSync(
              path.join(testsDir, 'streaming.test.ts'),
              `
describe('Streaming', () => {
  it('should use EncryptionStream', () => {
    const stream = new EncryptionStream();
  });
  it('should handle large files of 100 MB', () => {
    const large = Buffer.alloc(100);
  });
});
              `.trim()
            );

            // Add multi-recipient tests
            fs.writeFileSync(
              path.join(testsDir, 'multi.test.ts'),
              `
describe('Multi-recipient', () => {
  it('should encrypt for multiple recipients', () => {
    const recipients = [key1, key2];
    encryptMultiple(data, recipients);
  });
});
              `.trim()
            );

            // Add binary compatibility tests
            fs.writeFileSync(
              path.join(testsDir, 'compat.test.ts'),
              `
import { encrypt } from '@digitaldefiance/ecies-lib';
import { decrypt } from '@digitaldefiance/node-ecies-lib';

describe('Binary compatibility', () => {
  it('should work', () => {
    const e = encrypt(data, key);
    const d = decrypt(e, key);
  });
});
              `.trim()
            );

            const result = validateEciesTests(packagePath, 'test-package');

            // Should have no errors
            expect(result.errors).toHaveLength(0);

            // All checks should pass
            expect(result.matrixCoverage.coverage).toBe(100);
            expect(result.streamingTests.hasStreamingTests).toBe(true);
            expect(result.streamingTests.hasLargeFileTests).toBe(true);
            expect(result.multiRecipientTests.hasMultiRecipientTests).toBe(
              true
            );
            expect(
              result.binaryCompatibilityTests.hasBinaryCompatibilityTests
            ).toBe(true);
          } finally {
            fs.rmSync(packagePath, { recursive: true, force: true });
          }
        }),
        { numRuns: PROPERTY_TEST_CONFIG.EXPENSIVE }
      );
    });

    /**
     * Property: Report generation should be deterministic
     */
    it('should generate consistent reports for the same input', () => {
      fc.assert(
        fc.property(
          fc.record({
            coverage: fc.integer({ min: 0, max: 100 }),
            hasStreaming: fc.boolean(),
            hasLargeFile: fc.boolean(),
            hasMultiRecipient: fc.boolean(),
            hasBinaryCompat: fc.boolean(),
          }),
          (spec) => {
            const result = {
              packageName: 'test-package',
              matrixCoverage: {
                totalCombinations: 12,
                testedCombinations: Math.round((spec.coverage / 100) * 12),
                coverage: spec.coverage,
                matrix: [],
                missingCombinations: [],
              },
              streamingTests: {
                hasStreamingTests: spec.hasStreaming,
                hasLargeFileTests: spec.hasLargeFile,
                testFiles: [],
              },
              multiRecipientTests: {
                hasMultiRecipientTests: spec.hasMultiRecipient,
                testFiles: [],
              },
              binaryCompatibilityTests: {
                hasBinaryCompatibilityTests: spec.hasBinaryCompat,
                testFiles: [],
                crossPackageTestsExist: false,
              },
              errors: [],
              warnings: [],
            };

            const report1 = generateEciesTestReport(result);
            const report2 = generateEciesTestReport(result);
            const report3 = generateEciesTestReport(result);

            // Reports should be identical
            expect(report1).toBe(report2);
            expect(report2).toBe(report3);
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.SIMPLE }
      );
    });
  });
});
