/**
 * Tests for cross-package analyzer
 * **Feature: documentation-and-coverage-audit, Property 9: Integration Test Existence**
 * **Validates: Requirements 4.5**
 * **Feature: documentation-and-coverage-audit, Property 10: Integration Pattern Validation**
 * **Validates: Requirements 4.6**
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  analyzeDependencies,
  checkDocumentedIntegrations,
  findIntegrationPoints,
  validateBinaryCompatibility,
} from '../../src/analyzers/cross-package-analyzer';
import { PackageNode } from '../../src/types';

describe('Cross-Package Analyzer', () => {
  describe('analyzeDependencies', () => {
    it('should analyze dependencies in a monorepo', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const packagesDir = path.join(tempDir, 'packages');
      fs.mkdirSync(packagesDir, { recursive: true });

      try {
        // Create two packages
        const pkg1Dir = path.join(packagesDir, 'package1');
        const pkg2Dir = path.join(packagesDir, 'package2');
        fs.mkdirSync(pkg1Dir);
        fs.mkdirSync(pkg2Dir);

        // Create package.json files
        fs.writeFileSync(
          path.join(pkg1Dir, 'package.json'),
          JSON.stringify({
            name: '@test/package1',
            version: '1.0.0',
            dependencies: {
              '@test/package2': '1.0.0',
            },
          })
        );

        fs.writeFileSync(
          path.join(pkg2Dir, 'package.json'),
          JSON.stringify({
            name: '@test/package2',
            version: '1.0.0',
          })
        );

        const result = analyzeDependencies(tempDir);

        expect(result.packages.length).toBe(2);
        expect(result.dependencies.length).toBeGreaterThan(0);
        expect(result.integrationPoints).toBeDefined();
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should handle monorepo with no packages', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));

      try {
        const result = analyzeDependencies(tempDir);

        expect(result.packages).toEqual([]);
        expect(result.dependencies).toEqual([]);
        expect(result.integrationPoints).toEqual([]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('findIntegrationPoints', () => {
    it('should find integration points between packages', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const packagesDir = path.join(tempDir, 'packages');
      fs.mkdirSync(packagesDir, { recursive: true });

      try {
        // Create two packages
        const pkg1Dir = path.join(packagesDir, 'package1');
        const pkg2Dir = path.join(packagesDir, 'package2');
        fs.mkdirSync(pkg1Dir);
        fs.mkdirSync(pkg2Dir);

        // Create src directories
        const pkg1SrcDir = path.join(pkg1Dir, 'src');
        const pkg2SrcDir = path.join(pkg2Dir, 'src');
        fs.mkdirSync(pkg1SrcDir);
        fs.mkdirSync(pkg2SrcDir);

        // Create package.json files
        fs.writeFileSync(
          path.join(pkg1Dir, 'package.json'),
          JSON.stringify({ name: '@test/package1' })
        );

        fs.writeFileSync(
          path.join(pkg2Dir, 'package.json'),
          JSON.stringify({ name: '@test/package2' })
        );

        // Create a TypeScript file in package1 that imports from package2
        fs.writeFileSync(
          path.join(pkg1SrcDir, 'index.ts'),
          `import { something } from '@test/package2';\nexport function test() { return something; }`
        );

        // Create a TypeScript file in package2
        fs.writeFileSync(
          path.join(pkg2SrcDir, 'index.ts'),
          `export const something = 'test';`
        );

        const packages: PackageNode[] = [
          {
            name: '@test/package1',
            path: pkg1Dir,
            version: '1.0.0',
            dependencies: ['@test/package2'],
            devDependencies: [],
          },
          {
            name: '@test/package2',
            path: pkg2Dir,
            version: '1.0.0',
            dependencies: [],
            devDependencies: [],
          },
        ];

        const result = findIntegrationPoints(packages, tempDir);

        expect(result.length).toBeGreaterThan(0);
        expect(result[0].sourcePackage).toBe('@test/package1');
        expect(result[0].targetPackage).toBe('@test/package2');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should return empty array when no integration points exist', () => {
      const packages: PackageNode[] = [
        {
          name: '@test/package1',
          path: '/fake/path1',
          version: '1.0.0',
          dependencies: [],
          devDependencies: [],
        },
      ];

      const result = findIntegrationPoints(packages, '/fake/root');

      expect(result).toEqual([]);
    });
  });

  describe('validateBinaryCompatibility', () => {
    it('should report when ECIES packages are not found', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));

      try {
        const result = validateBinaryCompatibility(tempDir);

        expect(result.binaryCompatible).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.issues[0].severity).toBe('critical');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should find ECIES packages when they exist', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const packagesDir = path.join(tempDir, 'packages');
      fs.mkdirSync(packagesDir, { recursive: true });

      try {
        // Create ECIES packages
        const eciesDir = path.join(packagesDir, 'ecies-lib');
        const nodeEciesDir = path.join(packagesDir, 'node-ecies-lib');
        fs.mkdirSync(eciesDir);
        fs.mkdirSync(nodeEciesDir);

        fs.writeFileSync(
          path.join(eciesDir, 'package.json'),
          JSON.stringify({ name: 'ecies-lib', version: '1.0.0' })
        );

        fs.writeFileSync(
          path.join(nodeEciesDir, 'package.json'),
          JSON.stringify({ name: 'node-ecies-lib', version: '1.0.0' })
        );

        const result = validateBinaryCompatibility(tempDir);

        expect(result.eciesLibVersion).toBe('1.0.0');
        expect(result.nodeEciesLibVersion).toBe('1.0.0');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('checkDocumentedIntegrations', () => {
    it('should find documented integrations in README files', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
      const packagesDir = path.join(tempDir, 'packages');
      fs.mkdirSync(packagesDir, { recursive: true });

      try {
        // Create two packages
        const pkg1Dir = path.join(packagesDir, 'package1');
        const pkg2Dir = path.join(packagesDir, 'package2');
        fs.mkdirSync(pkg1Dir);
        fs.mkdirSync(pkg2Dir);

        fs.writeFileSync(
          path.join(pkg1Dir, 'package.json'),
          JSON.stringify({ name: '@test/package1' })
        );

        fs.writeFileSync(
          path.join(pkg2Dir, 'package.json'),
          JSON.stringify({ name: '@test/package2' })
        );

        // Create README that mentions package2
        fs.writeFileSync(
          path.join(pkg1Dir, 'README.md'),
          `# Package 1\n\nThis package integrates with @test/package2.`
        );

        const result = checkDocumentedIntegrations(tempDir);

        expect(result.length).toBeGreaterThan(0);
        expect(result[0].sourcePackage).toBe('@test/package1');
        expect(result[0].targetPackage).toBe('@test/package2');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should return empty array when no integrations are documented', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));

      try {
        const result = checkDocumentedIntegrations(tempDir);

        expect(result).toEqual([]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 9: Integration Test Existence
     * For any package that depends on another Express Suite package,
     * there should exist integration tests that import from both packages.
     *
     * This property test verifies that the analyzer correctly identifies
     * integration points and checks for corresponding tests.
     */
    it('should verify integration tests exist for cross-package dependencies', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^@test\/[a-z]+$/),
              hasDependency: fc.boolean(),
              hasIntegrationTest: fc.boolean(),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          (packages) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'audit-test-')
            );
            const packagesDir = path.join(tempDir, 'packages');
            fs.mkdirSync(packagesDir, { recursive: true });

            try {
              // Create packages
              for (let i = 0; i < packages.length; i++) {
                const pkg = packages[i];
                const pkgDir = path.join(packagesDir, `package${i}`);
                fs.mkdirSync(pkgDir);

                const srcDir = path.join(pkgDir, 'src');
                fs.mkdirSync(srcDir);

                // Create package.json
                const dependencies: Record<string, string> = {};
                if (pkg.hasDependency && i > 0) {
                  dependencies[packages[i - 1].name] = '1.0.0';
                }

                fs.writeFileSync(
                  path.join(pkgDir, 'package.json'),
                  JSON.stringify({
                    name: pkg.name,
                    version: '1.0.0',
                    dependencies,
                  })
                );

                // Create source file with import if has dependency
                if (pkg.hasDependency && i > 0) {
                  fs.writeFileSync(
                    path.join(srcDir, 'index.ts'),
                    `import { something } from '${
                      packages[i - 1].name
                    }';\nexport function test() { return something; }`
                  );
                } else {
                  fs.writeFileSync(
                    path.join(srcDir, 'index.ts'),
                    `export const something = 'test';`
                  );
                }

                // Create integration test if specified
                if (pkg.hasIntegrationTest && pkg.hasDependency && i > 0) {
                  const testsDir = path.join(pkgDir, 'tests');
                  fs.mkdirSync(testsDir);
                  fs.writeFileSync(
                    path.join(testsDir, 'integration.test.ts'),
                    `import { something } from '${
                      packages[i - 1].name
                    }';\nimport { test } from '../src/index';\ndescribe('integration', () => { it('works', () => { expect(test()).toBe(something); }); });`
                  );
                }
              }

              // Analyze dependencies
              const result = analyzeDependencies(tempDir);

              // Verify integration points
              for (const integrationPoint of result.integrationPoints) {
                const sourcePkg = packages.find(
                  (p) => p.name === integrationPoint.sourcePackage
                );

                if (sourcePkg) {
                  // If package has dependency and integration test, hasTests should be true
                  if (sourcePkg.hasDependency && sourcePkg.hasIntegrationTest) {
                    expect(integrationPoint.hasTests).toBe(true);
                  }

                  // If package has dependency but no integration test, hasTests should be false
                  if (
                    sourcePkg.hasDependency &&
                    !sourcePkg.hasIntegrationTest
                  ) {
                    expect(integrationPoint.hasTests).toBe(false);
                  }
                }
              }
            } finally {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property 10: Integration Pattern Validation
     * For any integration example documented in a README,
     * there should exist tests that validate the documented pattern works correctly.
     *
     * This property test verifies that documented integration patterns
     * have corresponding tests.
     */
    it('should verify documented integration patterns have tests', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^@test\/[a-z]+$/),
              hasDocumentation: fc.boolean(),
              hasExample: fc.boolean(),
              hasTest: fc.boolean(),
            }),
            { minLength: 2, maxLength: 4 }
          ),
          (packages) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'audit-test-')
            );
            const packagesDir = path.join(tempDir, 'packages');
            fs.mkdirSync(packagesDir, { recursive: true });

            try {
              // Create packages
              for (let i = 0; i < packages.length; i++) {
                const pkg = packages[i];
                const pkgDir = path.join(packagesDir, `package${i}`);
                fs.mkdirSync(pkgDir);

                fs.writeFileSync(
                  path.join(pkgDir, 'package.json'),
                  JSON.stringify({ name: pkg.name, version: '1.0.0' })
                );

                // Create README with documentation if specified
                if (pkg.hasDocumentation && i > 0) {
                  let readmeContent = `# ${pkg.name}\n\nIntegrates with ${
                    packages[i - 1].name
                  }.\n`;

                  if (pkg.hasExample) {
                    readmeContent += `\n\`\`\`typescript\nimport { something } from '${
                      packages[i - 1].name
                    }';\nconsole.log(something);\n\`\`\`\n`;
                  }

                  fs.writeFileSync(
                    path.join(pkgDir, 'README.md'),
                    readmeContent
                  );
                }

                // Create test if specified
                if (pkg.hasTest && i > 0) {
                  const testsDir = path.join(pkgDir, 'tests');
                  fs.mkdirSync(testsDir);
                  fs.writeFileSync(
                    path.join(testsDir, 'integration.test.ts'),
                    `import { something } from '${
                      packages[i - 1].name
                    }';\ndescribe('integration', () => { it('works', () => { expect(something).toBeDefined(); }); });`
                  );
                }
              }

              // Check documented integrations
              const result = checkDocumentedIntegrations(tempDir);

              // Verify documented integrations
              for (const integration of result) {
                const sourcePkg = packages.find(
                  (p) => p.name === integration.sourcePackage
                );

                if (sourcePkg) {
                  // If package has documentation and example, hasExample should be true
                  if (sourcePkg.hasDocumentation && sourcePkg.hasExample) {
                    expect(integration.hasExample).toBe(true);
                  }

                  // If package has test, hasTest should be true
                  if (sourcePkg.hasTest) {
                    expect(integration.hasTest).toBe(true);
                  }

                  // If package has documentation but no test, hasTest should be false
                  if (sourcePkg.hasDocumentation && !sourcePkg.hasTest) {
                    expect(integration.hasTest).toBe(false);
                  }
                }
              }
            } finally {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: Dependency graph should be acyclic or detect cycles
     */
    it('should handle dependency graphs correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^@test\/pkg[0-9]$/),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (packages) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'audit-test-')
            );
            const packagesDir = path.join(tempDir, 'packages');
            fs.mkdirSync(packagesDir, { recursive: true });

            try {
              // Create packages
              for (let i = 0; i < packages.length; i++) {
                const pkg = packages[i];
                const pkgDir = path.join(packagesDir, `package${i}`);
                fs.mkdirSync(pkgDir);

                fs.writeFileSync(
                  path.join(pkgDir, 'package.json'),
                  JSON.stringify({
                    name: pkg.name,
                    version: '1.0.0',
                  })
                );
              }

              const result = analyzeDependencies(tempDir);

              // Verify all packages are found
              expect(result.packages.length).toBe(packages.length);

              // Verify package names match
              const resultNames = new Set(result.packages.map((p) => p.name));
              const expectedNames = new Set(packages.map((p) => p.name));
              expect(resultNames).toEqual(expectedNames);
            } finally {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Integration points should have valid source and target packages
     */
    it('should ensure integration points reference valid packages', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^@test\/[a-z]+$/),
            }),
            { minLength: 2, maxLength: 4 }
          ),
          (packages) => {
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), 'audit-test-')
            );
            const packagesDir = path.join(tempDir, 'packages');
            fs.mkdirSync(packagesDir, { recursive: true });

            try {
              // Create packages
              for (let i = 0; i < packages.length; i++) {
                const pkg = packages[i];
                const pkgDir = path.join(packagesDir, `package${i}`);
                fs.mkdirSync(pkgDir);

                const srcDir = path.join(pkgDir, 'src');
                fs.mkdirSync(srcDir);

                fs.writeFileSync(
                  path.join(pkgDir, 'package.json'),
                  JSON.stringify({ name: pkg.name, version: '1.0.0' })
                );

                // Create source file with import to previous package
                if (i > 0) {
                  fs.writeFileSync(
                    path.join(srcDir, 'index.ts'),
                    `import { something } from '${packages[i - 1].name}';`
                  );
                } else {
                  fs.writeFileSync(
                    path.join(srcDir, 'index.ts'),
                    `export const something = 'test';`
                  );
                }
              }

              const result = analyzeDependencies(tempDir);
              const packageNames = new Set(result.packages.map((p) => p.name));

              // Verify all integration points reference valid packages
              for (const integrationPoint of result.integrationPoints) {
                expect(packageNames.has(integrationPoint.sourcePackage)).toBe(
                  true
                );
                expect(packageNames.has(integrationPoint.targetPackage)).toBe(
                  true
                );
                expect(integrationPoint.sourcePackage).not.toBe(
                  integrationPoint.targetPackage
                );
              }
            } finally {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    /**
     * Property: Binary compatibility report should have consistent state
     */
    it('should ensure binary compatibility report is consistent', () => {
      fc.assert(
        fc.property(fc.boolean(), (hasEciesPackages) => {
          const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
          const packagesDir = path.join(tempDir, 'packages');
          fs.mkdirSync(packagesDir, { recursive: true });

          try {
            if (hasEciesPackages) {
              // Create ECIES packages
              const eciesDir = path.join(packagesDir, 'ecies-lib');
              const nodeEciesDir = path.join(packagesDir, 'node-ecies-lib');
              fs.mkdirSync(eciesDir);
              fs.mkdirSync(nodeEciesDir);

              fs.writeFileSync(
                path.join(eciesDir, 'package.json'),
                JSON.stringify({ name: 'ecies-lib', version: '1.0.0' })
              );

              fs.writeFileSync(
                path.join(nodeEciesDir, 'package.json'),
                JSON.stringify({ name: 'node-ecies-lib', version: '1.0.0' })
              );
            }

            const result = validateBinaryCompatibility(tempDir);

            // Verify consistency
            if (hasEciesPackages) {
              expect(result.eciesLibVersion).not.toBe('not found');
              expect(result.nodeEciesLibVersion).not.toBe('not found');
            } else {
              expect(result.eciesLibVersion).toBe('not found');
              expect(result.nodeEciesLibVersion).toBe('not found');
              expect(result.binaryCompatible).toBe(false);
            }

            // If not binary compatible, should have issues
            if (!result.binaryCompatible) {
              expect(result.issues.length).toBeGreaterThan(0);
            }

            // All tests should have a name and description
            for (const test of result.compatibilityTests) {
              expect(test.name).toBeTruthy();
              expect(test.description).toBeTruthy();
              expect(typeof test.passed).toBe('boolean');
            }
          } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        }),
        { numRuns: 50 }
      );
    });
  });
});
