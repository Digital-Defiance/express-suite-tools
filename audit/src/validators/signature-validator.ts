/**
 * API Signature Validator
 * Validates that documented API signatures match actual TypeScript signatures
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseReadmeContent } from '../parsers/markdown-parser';
import { parseTypeScriptExports } from '../parsers/typescript-parser';
import { ExportedSymbol, ValidationError, ValidationResult } from '../types';

/**
 * Extract signature from TypeScript export
 */
function extractSignature(symbol: ExportedSymbol): string {
  return symbol.signature || '';
}

/**
 * Extract signature from documented symbol
 * Looks for code blocks or inline code near the symbol documentation
 */
function extractDocumentedSignature(
  readmeContent: string,
  symbolName: string
): string | null {
  // Look for the symbol name in the README
  const lines = readmeContent.split('\n');
  let foundSymbol = false;
  let signature = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line contains the symbol name as a heading or bold text
    if (
      line.includes(`### ${symbolName}`) ||
      line.includes(`## ${symbolName}`) ||
      line.includes(`**${symbolName}**`)
    ) {
      foundSymbol = true;
      continue;
    }

    // If we found the symbol, look for code blocks or inline code
    if (foundSymbol) {
      // Check for code block start
      if (line.trim().startsWith('```')) {
        const language = line.trim().substring(3).trim();
        if (
          language === 'typescript' ||
          language === 'ts' ||
          language === 'javascript' ||
          language === 'js' ||
          language === ''
        ) {
          // Collect code block content
          i++;
          const codeLines: string[] = [];
          while (i < lines.length && !lines[i].trim().startsWith('```')) {
            codeLines.push(lines[i]);
            i++;
          }
          const code = codeLines.join('\n').trim();

          // Check if this code contains the symbol name
          if (code.includes(symbolName)) {
            signature = code;
            break;
          }
        }
      }

      // Check for inline code
      const inlineCodeMatch = line.match(/`([^`]+)`/);
      if (inlineCodeMatch && inlineCodeMatch[1].includes(symbolName)) {
        signature = inlineCodeMatch[1];
        break;
      }

      // Stop searching after a certain number of lines
      if (foundSymbol && line.trim().startsWith('#')) {
        // Hit another heading, stop searching
        break;
      }
    }
  }

  return signature || null;
}

/**
 * Normalize a signature for comparison
 * Removes whitespace, comments, and other non-essential elements
 */
function normalizeSignature(signature: string): string {
  return signature
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/\/\/.*/g, '') // Remove line comments
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\s*([{}(),;:])\s*/g, '$1') // Remove whitespace around punctuation
    .trim();
}

/**
 * Compare two signatures for equivalence
 * Returns true if signatures are functionally equivalent
 */
function signaturesMatch(actual: string, documented: string): boolean {
  const normalizedActual = normalizeSignature(actual);
  const normalizedDocumented = normalizeSignature(documented);

  // Direct match
  if (normalizedActual === normalizedDocumented) {
    return true;
  }

  // Extract function name and check if parameters and return types are compatible
  // This handles cases where documentation might omit 'export' keyword
  const actualFuncMatch = normalizedActual.match(
    /function\s+(\w+)\s*\(([^)]*)\)(?::\s*(\w+))?/
  );
  const docFuncMatch = normalizedDocumented.match(
    /function\s+(\w+)\s*\(([^)]*)\)(?::\s*(\w+))?/
  );

  if (actualFuncMatch && docFuncMatch) {
    const [, actualName, actualParams, actualReturn] = actualFuncMatch;
    const [, docName, docParams, docReturn] = docFuncMatch;

    // Names must match
    if (actualName !== docName) {
      return false;
    }

    // Parameters must match (allowing for simplified documentation)
    const normalizedActualParams = actualParams.replace(/\s+/g, '');
    const normalizedDocParams = docParams.replace(/\s+/g, '');

    // If documented params are empty but actual has params, it's a mismatch
    if (normalizedDocParams === '' && normalizedActualParams !== '') {
      return false;
    }

    // If documented params exist, they should match actual params
    if (
      normalizedDocParams !== '' &&
      normalizedActualParams !== normalizedDocParams
    ) {
      return false;
    }

    // Return types must match if both are specified
    if (actualReturn && docReturn && actualReturn !== docReturn) {
      return false;
    }

    // If documented has return type but actual doesn't, it's a mismatch
    if (docReturn && !actualReturn) {
      return false;
    }

    // If actual has return type but documented doesn't, it's a mismatch
    if (actualReturn && !docReturn) {
      return false;
    }

    return true;
  }

  // Fallback: check if documented signature is a simplified version
  // (e.g., missing type annotations or return types)
  if (normalizedActual.includes(normalizedDocumented)) {
    return true;
  }

  return false;
}

/**
 * Validate API signatures for a package
 */
export function validateApiSignatures(packagePath: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Parse exports from TypeScript
  const exports = parseTypeScriptExports(packagePath);

  // Read README
  const readmePath = path.join(packagePath, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return {
      passed: true,
      errors: [],
      warnings: [],
      metrics: {
        documentationCompleteness: 0,
        testCoverage: 0,
        exampleCoverage: 0,
        crossReferenceValidity: 100,
      },
    };
  }

  const readmeContent = fs.readFileSync(readmePath, 'utf-8');
  const documentedSymbols = parseReadmeContent(readmePath);

  // Check each documented symbol
  for (const docSymbol of documentedSymbols) {
    const exportSymbol = exports.find((e) => e.name === docSymbol.name);

    if (!exportSymbol) {
      // Symbol is documented but doesn't exist in code
      warnings.push({
        type: 'OutdatedDocumentationWarning',
        severity: 'warning',
        message: `Documented symbol '${docSymbol.name}' not found in exports`,
        location: `README.md:${docSymbol.location.line}`,
        recommendation: `Remove documentation for '${docSymbol.name}' or verify the export exists in the code.`,
      });
      continue;
    }

    // Extract signatures
    const actualSignature = extractSignature(exportSymbol);
    const documentedSignature = extractDocumentedSignature(
      readmeContent,
      docSymbol.name
    );

    if (!documentedSignature) {
      // No signature found in documentation
      continue;
    }

    // Compare signatures
    if (!signaturesMatch(actualSignature, documentedSignature)) {
      errors.push({
        type: 'OutdatedSignatureError',
        severity: 'critical',
        message: `API signature mismatch for '${docSymbol.name}'`,
        location: `README.md:${docSymbol.location.line}`,
        recommendation: `Update the documented signature to match the actual signature:\nActual: ${actualSignature}\nDocumented: ${documentedSignature}`,
      });
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    metrics: {
      documentationCompleteness: 0,
      testCoverage: 0,
      exampleCoverage: 0,
      crossReferenceValidity: errors.length === 0 ? 100 : 0,
    },
  };
}

/**
 * Generate a report of signature mismatches
 */
export function generateSignatureReport(packagePath: string): string {
  const result = validateApiSignatures(packagePath);
  const packageName = path.basename(packagePath);

  let report = `\n=== API Signature Validation Report ===\n`;
  report += `Package: ${packageName}\n`;
  report += `Errors: ${result.errors.length}\n`;
  report += `Warnings: ${result.warnings.length}\n`;
  report += `\n`;

  if (result.errors.length > 0) {
    report += `Signature Mismatches:\n`;
    report += `${'='.repeat(50)}\n`;

    for (const error of result.errors) {
      report += `\n`;
      report += `❌ ${error.message}\n`;
      report += `   Location: ${error.location}\n`;
      report += `   ${error.recommendation}\n`;
    }
  }

  if (result.warnings.length > 0) {
    report += `\nWarnings:\n`;
    report += `${'='.repeat(50)}\n`;

    for (const warning of result.warnings) {
      report += `\n`;
      report += `⚠️  ${warning.message}\n`;
      report += `   Location: ${warning.location}\n`;
      report += `   ${warning.recommendation}\n`;
    }
  }

  if (result.errors.length === 0 && result.warnings.length === 0) {
    report += `✅ All API signatures are up to date!\n`;
  }

  return report;
}

/**
 * Validate signatures for CI/CD
 */
export function validateSignaturesForCI(
  packagePath: string,
  exitOnError: boolean = true
): ValidationResult {
  const result = validateApiSignatures(packagePath);

  console.log(generateSignatureReport(packagePath));

  if (!result.passed && exitOnError) {
    process.exit(1);
  }

  return result;
}

/**
 * Get all signature mismatches for a package
 */
export function getSignatureMismatches(packagePath: string): Array<{
  symbolName: string;
  actual: string;
  documented: string;
}> {
  const exports = parseTypeScriptExports(packagePath);
  const readmePath = path.join(packagePath, 'README.md');

  if (!fs.existsSync(readmePath)) {
    return [];
  }

  const readmeContent = fs.readFileSync(readmePath, 'utf-8');
  const documentedSymbols = parseReadmeContent(readmePath);
  const mismatches: Array<{
    symbolName: string;
    actual: string;
    documented: string;
  }> = [];

  for (const docSymbol of documentedSymbols) {
    const exportSymbol = exports.find((e) => e.name === docSymbol.name);

    if (!exportSymbol) {
      continue;
    }

    const actualSignature = extractSignature(exportSymbol);
    const documentedSignature = extractDocumentedSignature(
      readmeContent,
      docSymbol.name
    );

    if (
      documentedSignature &&
      !signaturesMatch(actualSignature, documentedSignature)
    ) {
      mismatches.push({
        symbolName: docSymbol.name,
        actual: actualSignature,
        documented: documentedSignature,
      });
    }
  }

  return mismatches;
}
