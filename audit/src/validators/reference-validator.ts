/**
 * Cross-reference validator for validating package references in README files
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseTypeScriptExports } from '../parsers/typescript-parser';
import { CrossReference } from '../types';

/**
 * Parse README content for package references
 * Looks for patterns like @digitaldefiance/* or @express-suite/*
 * @param readmePath - Path to the README file
 * @param sourcePackage - Name of the package containing this README
 * @returns Array of cross-references found in the README
 */
export function parsePackageReferences(
  readmePath: string,
  sourcePackage: string
): CrossReference[] {
  if (!fs.existsSync(readmePath)) {
    return [];
  }

  const content = fs.readFileSync(readmePath, 'utf-8');
  const lines = content.split('\n');
  const references: CrossReference[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Pattern 1: Package references in import statements
    // import { something } from '@digitaldefiance/package-name'
    const importPattern =
      /import\s+(?:{[^}]+}|[a-zA-Z][a-zA-Z0-9]*)\s+from\s+['"](@(?:digitaldefiance|express-suite)\/[a-z0-9-]+)['"]/g;
    let match;

    while ((match = importPattern.exec(line)) !== null) {
      const targetPackage = match[1];
      references.push({
        sourcePackage,
        targetPackage,
        location: {
          file: readmePath,
          line: lineNumber,
          column: match.index + 1,
        },
        isValid: false, // Will be validated later
      });
    }

    // Pattern 2: Package references in markdown links
    // [@digitaldefiance/package-name](...)
    const linkPattern = /\[(@(?:digitaldefiance|express-suite)\/[a-z0-9-]+)\]/g;
    while ((match = linkPattern.exec(line)) !== null) {
      const targetPackage = match[1];
      references.push({
        sourcePackage,
        targetPackage,
        location: {
          file: readmePath,
          line: lineNumber,
          column: match.index + 1,
        },
        isValid: false,
      });
    }

    // Pattern 3: Package references in code blocks or inline code
    // `@digitaldefiance/package-name`
    const codePattern = /`(@(?:digitaldefiance|express-suite)\/[a-z0-9-]+)`/g;
    while ((match = codePattern.exec(line)) !== null) {
      const targetPackage = match[1];
      references.push({
        sourcePackage,
        targetPackage,
        location: {
          file: readmePath,
          line: lineNumber,
          column: match.index + 1,
        },
        isValid: false,
      });
    }

    // Pattern 4: npm install commands
    // npm install @digitaldefiance/package-name
    const npmPattern =
      /npm\s+install\s+(@(?:digitaldefiance|express-suite)\/[a-z0-9-]+)/g;
    while ((match = npmPattern.exec(line)) !== null) {
      const targetPackage = match[1];
      references.push({
        sourcePackage,
        targetPackage,
        location: {
          file: readmePath,
          line: lineNumber,
          column: match.index + 1,
        },
        isValid: false,
      });
    }

    // Pattern 5: yarn add commands
    // yarn add @digitaldefiance/package-name
    const yarnPattern =
      /yarn\s+add\s+(@(?:digitaldefiance|express-suite)\/[a-z0-9-]+)/g;
    while ((match = yarnPattern.exec(line)) !== null) {
      const targetPackage = match[1];
      references.push({
        sourcePackage,
        targetPackage,
        location: {
          file: readmePath,
          line: lineNumber,
          column: match.index + 1,
        },
        isValid: false,
      });
    }

    // Pattern 6: References with specific exports
    // import { MyClass } from '@digitaldefiance/package-name'
    const importWithSymbolPattern =
      /import\s+{([^}]+)}\s+from\s+['"](@(?:digitaldefiance|express-suite)\/[a-z0-9-]+)['"]/g;
    while ((match = importWithSymbolPattern.exec(line)) !== null) {
      const symbols = match[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const targetPackage = match[2];

      for (const symbol of symbols) {
        references.push({
          sourcePackage,
          targetPackage,
          targetSymbol: symbol,
          location: {
            file: readmePath,
            line: lineNumber,
            column: match.index + 1,
          },
          isValid: false,
        });
      }
    }
  }

  // Remove duplicates
  const uniqueRefs = new Map<string, CrossReference>();
  for (const ref of references) {
    const key = `${ref.targetPackage}:${ref.targetSymbol || ''}:${
      ref.location.line
    }`;
    if (!uniqueRefs.has(key)) {
      uniqueRefs.set(key, ref);
    }
  }

  return Array.from(uniqueRefs.values());
}

/**
 * Verify that referenced packages exist in the monorepo
 * @param references - Array of cross-references to validate
 * @param monorepoRoot - Path to the monorepo root directory
 * @returns Updated references with isValid flag set
 */
export function verifyPackageExists(
  references: CrossReference[],
  monorepoRoot: string
): CrossReference[] {
  const packagesDir = path.join(monorepoRoot, 'packages');

  return references.map((ref) => {
    // Extract package name from scoped package
    // @digitaldefiance/package-name -> digitaldefiance-package-name
    const scopedName = ref.targetPackage.split('/')[1];
    const scope = ref.targetPackage.split('/')[0].replace('@', '');
    const packageName = `${scope}-${scopedName}`;
    const packagePath = path.join(packagesDir, packageName);

    // Check if package directory exists
    const exists = fs.existsSync(packagePath);

    // Check if package.json exists
    const packageJsonPath = path.join(packagePath, 'package.json');
    const hasPackageJson = exists && fs.existsSync(packageJsonPath);

    return {
      ...ref,
      isValid: hasPackageJson,
    };
  });
}

/**
 * Verify that referenced exports exist in target packages
 * @param references - Array of cross-references with targetSymbol
 * @param monorepoRoot - Path to the monorepo root directory
 * @returns Updated references with isValid flag set based on export existence
 */
export function verifyExportExists(
  references: CrossReference[],
  monorepoRoot: string
): CrossReference[] {
  const packagesDir = path.join(monorepoRoot, 'packages');

  return references.map((ref) => {
    // If no specific symbol is referenced, just check package existence
    if (!ref.targetSymbol) {
      return ref;
    }

    // Extract package name from scoped package
    // @digitaldefiance/package-name -> digitaldefiance-package-name
    const scopedName = ref.targetPackage.split('/')[1];
    const scope = ref.targetPackage.split('/')[0].replace('@', '');
    const packageName = `${scope}-${scopedName}`;
    const packagePath = path.join(packagesDir, packageName);

    // Check if package exists
    if (!fs.existsSync(packagePath)) {
      return {
        ...ref,
        isValid: false,
      };
    }

    try {
      // Parse exports from the target package
      const exports = parseTypeScriptExports(packagePath);

      // Check if the referenced symbol exists in exports
      const symbolExists = exports.some((exp) => exp.name === ref.targetSymbol);

      return {
        ...ref,
        isValid: symbolExists,
      };
    } catch (error) {
      // If parsing fails, mark as invalid
      return {
        ...ref,
        isValid: false,
      };
    }
  });
}

/**
 * Validate all cross-references in a README file
 * @param readmePath - Path to the README file
 * @param sourcePackage - Name of the package containing this README
 * @param monorepoRoot - Path to the monorepo root directory
 * @returns Array of validated cross-references
 */
export function validateCrossReferences(
  readmePath: string,
  sourcePackage: string,
  monorepoRoot: string
): CrossReference[] {
  // Parse references from README
  let references = parsePackageReferences(readmePath, sourcePackage);

  // Verify package existence
  references = verifyPackageExists(references, monorepoRoot);

  // Verify export existence for references with specific symbols
  references = verifyExportExists(references, monorepoRoot);

  return references;
}

/**
 * Get all invalid cross-references from a list
 * @param references - Array of cross-references
 * @returns Array of invalid cross-references
 */
export function getInvalidReferences(
  references: CrossReference[]
): CrossReference[] {
  return references.filter((ref) => !ref.isValid);
}

/**
 * Get all valid cross-references from a list
 * @param references - Array of cross-references
 * @returns Array of valid cross-references
 */
export function getValidReferences(
  references: CrossReference[]
): CrossReference[] {
  return references.filter((ref) => ref.isValid);
}
