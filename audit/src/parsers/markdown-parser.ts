/**
 * Markdown parser for extracting documented symbols from README files
 * Uses a simple regex-based approach to avoid ESM module issues
 */

import * as fs from 'fs';
import { CodeExample, DocumentedSymbol } from '../types';

/**
 * Parse README content and extract documented symbols
 * @param readmePath - Path to the README file
 * @returns Array of documented symbols with their metadata
 */
export function parseReadmeContent(readmePath: string): DocumentedSymbol[] {
  if (!fs.existsSync(readmePath)) {
    return [];
  }

  const content = fs.readFileSync(readmePath, 'utf-8');
  const lines = content.split('\n');
  const documentedSymbols: DocumentedSymbol[] = [];

  let currentHeading: string | null = null;
  let currentDescription: string[] = [];
  let currentLine = 0;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';
  let codeBlockStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    currentLine = i + 1;

    // Handle code blocks
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        // Starting a code block
        inCodeBlock = true;
        codeBlockLang = line.trim().substring(3).trim();
        codeBlockContent = [];
        codeBlockStartLine = currentLine;
      } else {
        // Ending a code block
        inCodeBlock = false;
        if (
          codeBlockLang === 'typescript' ||
          codeBlockLang === 'javascript' ||
          codeBlockLang === 'ts' ||
          codeBlockLang === 'js'
        ) {
          const symbols = extractSymbolsFromCode(
            codeBlockContent.join('\n'),
            readmePath,
            codeBlockStartLine
          );
          documentedSymbols.push(...symbols);
        }
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Handle headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      // Save previous section
      if (currentHeading && currentDescription.length > 0) {
        const symbols = extractSymbolsFromHeading(
          currentHeading,
          currentDescription.join(' '),
          readmePath,
          currentLine
        );
        documentedSymbols.push(...symbols);
      }

      // Start new section
      currentHeading = headingMatch[2].trim();
      currentDescription = [];
      continue;
    }

    // Collect description text (non-empty lines that aren't headings or code)
    if (line.trim() && !line.trim().startsWith('```')) {
      currentDescription.push(line.trim());

      // Extract backtick-wrapped identifiers from description lines
      const backtickPattern = /`([a-zA-Z][a-zA-Z0-9]*)`/g;
      let match;
      while ((match = backtickPattern.exec(line)) !== null) {
        const name = match[1];
        // Avoid duplicates
        if (!documentedSymbols.some((s) => s.name === name)) {
          documentedSymbols.push({
            name,
            description: line.trim(),
            location: { file: readmePath, line: currentLine, column: 1 },
            hasUsageExample: false,
          });
        }
      }
    }
  }

  // Save last section
  if (currentHeading && currentDescription.length > 0) {
    const symbols = extractSymbolsFromHeading(
      currentHeading,
      currentDescription.join(' '),
      readmePath,
      currentLine
    );
    documentedSymbols.push(...symbols);
  }

  return documentedSymbols;
}

/**
 * Extract code examples from README
 * @param readmePath - Path to the README file
 * @returns Array of code examples with metadata
 */
export function extractCodeExamples(readmePath: string): CodeExample[] {
  if (!fs.existsSync(readmePath)) {
    return [];
  }

  const content = fs.readFileSync(readmePath, 'utf-8');
  const lines = content.split('\n');
  const examples: CodeExample[] = [];

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';
  let codeBlockStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const currentLine = i + 1;

    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        // Starting a code block
        inCodeBlock = true;
        codeBlockLang = line.trim().substring(3).trim() || 'text';
        codeBlockContent = [];
        codeBlockStartLine = currentLine;
      } else {
        // Ending a code block
        inCodeBlock = false;
        const code = codeBlockContent.join('\n');
        const referencedSymbols = extractReferencedSymbols(code);

        examples.push({
          code,
          language: codeBlockLang,
          location: {
            file: readmePath,
            line: codeBlockStartLine,
            column: 1,
          },
          referencedSymbols,
          hasTest: false,
        });
      }
    } else if (inCodeBlock) {
      codeBlockContent.push(line);
    }
  }

  return examples;
}

/**
 * Extract symbols from heading text
 * Looks for patterns like:
 * - "functionName()" or "functionName(args)"
 * - "ClassName"
 * - "interfaceName"
 * - API reference sections
 */
function extractSymbolsFromHeading(
  heading: string,
  description: string,
  file: string,
  line: number
): DocumentedSymbol[] {
  const symbols: DocumentedSymbol[] = [];

  // Pattern 1: Function calls - functionName() or functionName(args)
  const functionPattern = /\b([a-z][a-zA-Z0-9]*)\s*\([^)]*\)/g;
  let match;

  while ((match = functionPattern.exec(heading)) !== null) {
    symbols.push({
      name: match[1],
      description: description || heading,
      location: { file, line, column: 1 },
      hasUsageExample: false,
    });
  }

  // Pattern 2: Class names (PascalCase)
  const classPattern = /\b([A-Z][a-zA-Z0-9]*)\b/g;
  while ((match = classPattern.exec(heading)) !== null) {
    // Avoid duplicates and common words
    const name = match[1];
    if (!symbols.some((s) => s.name === name) && !isCommonWord(name)) {
      symbols.push({
        name,
        description: description || heading,
        location: { file, line, column: 1 },
        hasUsageExample: false,
      });
    }
  }

  // Pattern 3: Backtick-wrapped identifiers
  const backtickPattern = /`([a-zA-Z][a-zA-Z0-9]*)`/g;
  while ((match = backtickPattern.exec(heading)) !== null) {
    const name = match[1];
    if (!symbols.some((s) => s.name === name)) {
      symbols.push({
        name,
        description: description || heading,
        location: { file, line, column: 1 },
        hasUsageExample: false,
      });
    }
  }

  return symbols;
}

/**
 * Extract symbols from code blocks
 * Looks for export statements and function/class definitions
 */
function extractSymbolsFromCode(
  code: string,
  file: string,
  line: number
): DocumentedSymbol[] {
  const symbols: DocumentedSymbol[] = [];

  // Pattern 1: export function/class/interface/type
  const exportPattern =
    /export\s+(?:function|class|interface|type|const)\s+([a-zA-Z][a-zA-Z0-9]*)/g;
  let match;

  while ((match = exportPattern.exec(code)) !== null) {
    symbols.push({
      name: match[1],
      description: 'Documented in code example',
      location: { file, line, column: 1 },
      hasUsageExample: true,
    });
  }

  // Pattern 2: Function/class usage (not definitions)
  const usagePattern = /\b([a-z][a-zA-Z0-9]*)\s*\(/g;
  while ((match = usagePattern.exec(code)) !== null) {
    const name = match[1];
    // Skip common keywords
    if (!isCommonKeyword(name) && !symbols.some((s) => s.name === name)) {
      symbols.push({
        name,
        description: 'Used in code example',
        location: { file, line, column: 1 },
        hasUsageExample: true,
      });
    }
  }

  return symbols;
}

/**
 * Extract referenced symbols from code
 * Identifies function calls, class instantiations, and imports
 */
function extractReferencedSymbols(code: string): string[] {
  const symbols = new Set<string>();

  // Pattern 1: Import statements
  const importPattern = /import\s+(?:{([^}]+)}|([a-zA-Z][a-zA-Z0-9]*))/g;
  let match;

  while ((match = importPattern.exec(code)) !== null) {
    if (match[1]) {
      // Named imports
      const names = match[1].split(',').map((n) => n.trim());
      names.forEach((name) => symbols.add(name));
    } else if (match[2]) {
      // Default import
      symbols.add(match[2]);
    }
  }

  // Pattern 2: Function calls
  const functionPattern = /\b([a-z][a-zA-Z0-9]*)\s*\(/g;
  while ((match = functionPattern.exec(code)) !== null) {
    if (!isCommonKeyword(match[1])) {
      symbols.add(match[1]);
    }
  }

  // Pattern 3: Class instantiations (new ClassName)
  const classPattern = /new\s+([A-Z][a-zA-Z0-9]*)/g;
  while ((match = classPattern.exec(code)) !== null) {
    symbols.add(match[1]);
  }

  // Pattern 4: Type references in TypeScript
  const typePattern = /:\s*([A-Z][a-zA-Z0-9]*)/g;
  while ((match = typePattern.exec(code)) !== null) {
    if (!isCommonWord(match[1])) {
      symbols.add(match[1]);
    }
  }

  return Array.from(symbols);
}

/**
 * Check if a word is a common English word (to avoid false positives)
 */
function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    'The',
    'This',
    'That',
    'These',
    'Those',
    'When',
    'Where',
    'Why',
    'How',
    'What',
    'Which',
    'Who',
    'API',
    'Usage',
    'Example',
    'Examples',
    'Installation',
    'Configuration',
    'Options',
    'Parameters',
    'Returns',
    'Throws',
    'See',
    'Note',
    'Warning',
    'Error',
    'Success',
    'Failed',
    'True',
    'False',
  ]);

  return commonWords.has(word);
}

/**
 * Check if a word is a common programming keyword
 */
function isCommonKeyword(word: string): boolean {
  const keywords = new Set([
    'if',
    'else',
    'for',
    'while',
    'do',
    'switch',
    'case',
    'break',
    'continue',
    'return',
    'throw',
    'try',
    'catch',
    'finally',
    'function',
    'class',
    'const',
    'let',
    'var',
    'new',
    'this',
    'super',
    'import',
    'export',
    'from',
    'as',
    'default',
    'async',
    'await',
    'typeof',
    'instanceof',
    'delete',
    'void',
    'yield',
    'static',
    'public',
    'private',
    'protected',
    'readonly',
    'get',
    'set',
    'constructor',
    'extends',
    'implements',
    'interface',
    'type',
    'enum',
    'namespace',
    'module',
    'declare',
    'abstract',
  ]);

  return keywords.has(word);
}
