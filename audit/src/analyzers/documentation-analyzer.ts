/**
 * Documentation analyzer for verifying documentation completeness
 * Coordinates parsing and analysis to identify documentation gaps
 */

import * as fs from 'fs';
import * as path from 'path';
import { extractCodeExamples } from '../parsers/example-extractor';
import { parseReadmeContent } from '../parsers/markdown-parser';
import { parseTypeScriptExports } from '../parsers/typescript-parser';
import {
  CodeExample,
  ConfigOption,
  DocumentedSymbol,
  ExportedSymbol,
  PackageDocumentation,
} from '../types';

/**
 * Analyze a package for documentation completeness
 * @param packagePath - Path to the package directory
 * @returns Package documentation analysis
 */
export function analyzePackage(packagePath: string): PackageDocumentation {
  // Get package name from package.json
  const packageJsonPath = path.join(packagePath, 'package.json');
  let packageName = path.basename(packagePath);

  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      packageName = packageJson.name || packageName;
    } catch (_error) {
      // Use directory name as fallback
    }
  }

  // Parse TypeScript exports
  const exports = parseTypeScriptExports(packagePath);

  // Parse README documentation
  const readmePath = findReadme(packagePath);
  const documentedSymbols = readmePath ? parseReadmeContent(readmePath) : [];
  const examples = readmePath ? extractCodeExamples(readmePath) : [];

  // Extract configuration options from TypeScript interfaces
  const configOptions = extractConfigOptions(packagePath);

  // Match exports to documentation
  const matchedExports = matchExportsToDocumentation(
    exports,
    documentedSymbols,
    examples
  );

  return {
    packageName,
    exports: matchedExports,
    documentedSymbols,
    examples,
    crossReferences: [], // Will be populated by cross-reference validator
    configOptions,
  };
}

/**
 * Match exported symbols to their documentation
 * Updates the isDocumented and hasExample flags on exports
 * @param exports - Array of exported symbols
 * @param documentedSymbols - Array of documented symbols from README
 * @param examples - Array of code examples from README
 * @returns Updated array of exported symbols with documentation flags set
 */
export function matchExportsToDocumentation(
  exports: ExportedSymbol[],
  documentedSymbols: DocumentedSymbol[],
  examples: CodeExample[]
): ExportedSymbol[] {
  // Create lookup sets for efficient matching
  const documentedNames = new Set(documentedSymbols.map((s) => s.name));
  const symbolsWithExamples = new Set<string>();

  // Find symbols that appear in examples
  for (const example of examples) {
    for (const symbol of example.referencedSymbols) {
      symbolsWithExamples.add(symbol);
    }
  }

  // Also check if documented symbols have examples
  for (const docSymbol of documentedSymbols) {
    if (docSymbol.hasUsageExample) {
      symbolsWithExamples.add(docSymbol.name);
    }
  }

  // Update exports with documentation status
  return exports.map((exp) => ({
    ...exp,
    isDocumented: documentedNames.has(exp.name),
    hasExample: symbolsWithExamples.has(exp.name),
  }));
}

/**
 * Find undocumented exports in a package
 * @param packageDoc - Package documentation analysis
 * @returns Array of undocumented exported symbols
 */
export function findUndocumentedExports(
  packageDoc: PackageDocumentation
): ExportedSymbol[] {
  return packageDoc.exports.filter((exp) => !exp.isDocumented);
}

/**
 * Find major features (classes and primary functions) without examples
 * @param packageDoc - Package documentation analysis
 * @returns Array of exported symbols that lack usage examples
 */
export function findMissingExamples(
  packageDoc: PackageDocumentation
): ExportedSymbol[] {
  // Major features are classes and functions (not interfaces, types, or constants)
  const majorFeatures = packageDoc.exports.filter(
    (exp) => exp.type === 'class' || exp.type === 'function'
  );

  return majorFeatures.filter((exp) => !exp.hasExample);
}

/**
 * Find the README file in a package directory
 * Checks for README.md, readme.md, README, etc.
 * @param packagePath - Path to the package directory
 * @returns Path to README file or null if not found
 */
function findReadme(packagePath: string): string | null {
  const possibleNames = [
    'README.md',
    'readme.md',
    'Readme.md',
    'README',
    'readme',
    'README.markdown',
    'readme.markdown',
  ];

  for (const name of possibleNames) {
    const readmePath = path.join(packagePath, name);
    if (fs.existsSync(readmePath)) {
      return readmePath;
    }
  }

  return null;
}

/**
 * Extract configuration options from TypeScript interfaces
 * Looks for interfaces with "Config", "Options", or "Settings" in the name
 * @param packagePath - Path to the package directory
 * @returns Array of configuration options
 */
function extractConfigOptions(packagePath: string): ConfigOption[] {
  const configOptions: ConfigOption[] = [];
  const exports = parseTypeScriptExports(packagePath);

  // Find interfaces that look like configuration
  const configInterfaces = exports.filter(
    (exp) =>
      exp.type === 'interface' &&
      (exp.name.includes('Config') ||
        exp.name.includes('Options') ||
        exp.name.includes('Settings'))
  );

  // For now, we just mark these as potential config options
  // A more sophisticated implementation would parse the interface members
  for (const configInterface of configInterfaces) {
    configOptions.push({
      name: configInterface.name,
      type: 'interface',
      description: `Configuration interface: ${configInterface.name}`,
      isDocumented: configInterface.isDocumented,
    });
  }

  return configOptions;
}

/**
 * Find undocumented configuration options
 * @param packageDoc - Package documentation analysis
 * @returns Array of configuration options that are not documented
 */
export function findUndocumentedConfigOptions(
  packageDoc: PackageDocumentation
): ConfigOption[] {
  return packageDoc.configOptions.filter((opt) => !opt.isDocumented);
}

/**
 * Calculate documentation completeness percentage
 * @param packageDoc - Package documentation analysis
 * @returns Percentage of exports that are documented (0-100)
 */
export function calculateDocumentationCompleteness(
  packageDoc: PackageDocumentation
): number {
  if (packageDoc.exports.length === 0) {
    return 100; // No exports means nothing to document
  }

  const documentedCount = packageDoc.exports.filter(
    (exp) => exp.isDocumented
  ).length;

  return Math.round((documentedCount / packageDoc.exports.length) * 100);
}

/**
 * Calculate example coverage percentage
 * @param packageDoc - Package documentation analysis
 * @returns Percentage of major features with examples (0-100)
 */
export function calculateExampleCoverage(
  packageDoc: PackageDocumentation
): number {
  const majorFeatures = packageDoc.exports.filter(
    (exp) => exp.type === 'class' || exp.type === 'function'
  );

  if (majorFeatures.length === 0) {
    return 100; // No major features means nothing to exemplify
  }

  const withExamples = majorFeatures.filter((exp) => exp.hasExample).length;

  return Math.round((withExamples / majorFeatures.length) * 100);
}
