/**
 * Code example extractor for extracting and analyzing code blocks from Markdown files
 * Identifies language, extracts referenced symbols, and tracks locations for error reporting
 */

import * as fs from 'fs';
import { CodeExample, MarkdownLocation } from '../types';

/**
 * Extract all code examples from a Markdown file
 * @param markdownPath - Path to the Markdown file
 * @returns Array of code examples with metadata
 */
export function extractCodeExamples(markdownPath: string): CodeExample[] {
  if (!fs.existsSync(markdownPath)) {
    return [];
  }

  const content = fs.readFileSync(markdownPath, 'utf-8');
  const lines = content.split('\n');
  const examples: CodeExample[] = [];

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';
  let codeBlockStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const currentLine = i + 1;

    // Detect code block fence (```)
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        // Starting a code block
        inCodeBlock = true;
        // Extract language identifier after ```
        codeBlockLang = line.trim().substring(3).trim() || 'text';
        codeBlockContent = [];
        codeBlockStartLine = currentLine;
      } else {
        // Ending a code block
        inCodeBlock = false;
        const code = codeBlockContent.join('\n');
        const language = normalizeLanguage(codeBlockLang);
        const referencedSymbols = extractReferencedSymbols(code, language);

        examples.push({
          code,
          language,
          location: {
            file: markdownPath,
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
 * Normalize language identifiers to standard names
 * @param lang - Raw language identifier from code fence
 * @returns Normalized language name
 */
function normalizeLanguage(lang: string): string {
  const normalized = lang.toLowerCase().trim();

  // Map common variations to standard names
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    tsx: 'typescript',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    markdown: 'markdown',
    text: 'text',
    txt: 'text',
    '': 'text',
  };

  return languageMap[normalized] || normalized;
}

/**
 * Extract referenced symbols from code based on language
 * @param code - Code content
 * @param language - Programming language
 * @returns Array of symbol names referenced in the code
 */
export function extractReferencedSymbols(
  code: string,
  language: string
): string[] {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return extractJavaScriptSymbols(code);
    case 'bash':
      return extractBashSymbols(code);
    default:
      return [];
  }
}

/**
 * Extract symbols from JavaScript/TypeScript code
 * Identifies imports, function calls, class instantiations, and type references
 */
function extractJavaScriptSymbols(code: string): string[] {
  const symbols = new Set<string>();

  // Pattern 1: Named imports - import { foo, bar } from 'module'
  const namedImportPattern = /import\s+{([^}]+)}\s+from/g;
  let match;

  while ((match = namedImportPattern.exec(code)) !== null) {
    const imports = match[1]
      .split(',')
      .map((s) => s.trim())
      .map((s) => {
        // Handle "as" aliases: import { foo as bar }
        const parts = s.split(/\s+as\s+/);
        return parts[0].trim();
      })
      .filter((s) => s.length > 0);

    imports.forEach((imp) => symbols.add(imp));
  }

  // Pattern 2: Default imports - import Foo from 'module'
  const defaultImportPattern = /import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from/g;
  while ((match = defaultImportPattern.exec(code)) !== null) {
    symbols.add(match[1]);
  }

  // Pattern 3: Namespace imports - import * as foo from 'module'
  const namespaceImportPattern =
    /import\s+\*\s+as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from/g;
  while ((match = namespaceImportPattern.exec(code)) !== null) {
    symbols.add(match[1]);
  }

  // Pattern 4: Function calls - functionName(...)
  const functionCallPattern = /\b([a-z_$][a-zA-Z0-9_$]*)\s*\(/g;
  while ((match = functionCallPattern.exec(code)) !== null) {
    const name = match[1];
    if (!isJavaScriptKeyword(name) && !isCommonMethod(name)) {
      symbols.add(name);
    }
  }

  // Pattern 5: Class instantiations - new ClassName(...)
  const classInstantiationPattern = /\bnew\s+([A-Z][a-zA-Z0-9_$]*)/g;
  while ((match = classInstantiationPattern.exec(code)) !== null) {
    symbols.add(match[1]);
  }

  // Pattern 6: Type annotations - : TypeName
  const typeAnnotationPattern = /:\s*([A-Z][a-zA-Z0-9_$]*)/g;
  while ((match = typeAnnotationPattern.exec(code)) !== null) {
    const typeName = match[1];
    if (!isBuiltInType(typeName)) {
      symbols.add(typeName);
    }
  }

  // Pattern 7: Generic type parameters - <TypeName>
  const genericTypePattern = /<([A-Z][a-zA-Z0-9_$]*)>/g;
  while ((match = genericTypePattern.exec(code)) !== null) {
    const typeName = match[1];
    if (!isBuiltInType(typeName)) {
      symbols.add(typeName);
    }
  }

  // Pattern 8: Property access on imported modules - module.method()
  const propertyAccessPattern =
    /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\.[a-zA-Z_$][a-zA-Z0-9_$]*/g;
  while ((match = propertyAccessPattern.exec(code)) !== null) {
    const objectName = match[1];
    if (!isJavaScriptKeyword(objectName)) {
      symbols.add(objectName);
    }
  }

  return Array.from(symbols);
}

/**
 * Extract symbols from Bash code
 * Identifies command names and script references
 */
function extractBashSymbols(code: string): string[] {
  const symbols = new Set<string>();

  // Pattern 1: Command names at start of line or after pipe/semicolon
  const commandPattern = /(?:^|[|;&]\s*)([a-zA-Z_][a-zA-Z0-9_-]*)/gm;
  let match;

  while ((match = commandPattern.exec(code)) !== null) {
    const command = match[1];
    if (!isCommonBashCommand(command)) {
      symbols.add(command);
    }
  }

  // Pattern 2: Script executions - ./script.sh or bash script.sh
  const scriptPattern =
    /(?:bash|sh|\.\/|\.\.\/)?([a-zA-Z_][a-zA-Z0-9_-]*\.(?:sh|bash))/g;
  while ((match = scriptPattern.exec(code)) !== null) {
    symbols.add(match[1]);
  }

  // Pattern 3: Function definitions - function_name() { ... }
  const functionDefPattern = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\)\s*{/gm;
  while ((match = functionDefPattern.exec(code)) !== null) {
    symbols.add(match[1]);
  }

  return Array.from(symbols);
}

/**
 * Check if a word is a JavaScript/TypeScript keyword
 */
function isJavaScriptKeyword(word: string): boolean {
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
    'in',
    'of',
    'with',
  ]);

  return keywords.has(word);
}

/**
 * Check if a name is a common method that shouldn't be tracked
 */
function isCommonMethod(name: string): boolean {
  const commonMethods = new Set([
    'log',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
    'assert',
    'dir',
    'table',
    'time',
    'timeEnd',
    'group',
    'groupEnd',
    'clear',
    'count',
    'push',
    'pop',
    'shift',
    'unshift',
    'slice',
    'splice',
    'concat',
    'join',
    'reverse',
    'sort',
    'filter',
    'map',
    'reduce',
    'forEach',
    'find',
    'findIndex',
    'some',
    'every',
    'includes',
    'indexOf',
    'lastIndexOf',
    'toString',
    'valueOf',
    'toLocaleString',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
  ]);

  return commonMethods.has(name);
}

/**
 * Check if a type name is a built-in TypeScript type
 */
function isBuiltInType(typeName: string): boolean {
  const builtInTypes = new Set([
    'String',
    'Number',
    'Boolean',
    'Array',
    'Object',
    'Function',
    'Date',
    'RegExp',
    'Error',
    'Promise',
    'Map',
    'Set',
    'WeakMap',
    'WeakSet',
    'Symbol',
    'BigInt',
    'Proxy',
    'Reflect',
    'JSON',
    'Math',
    'Intl',
    'ArrayBuffer',
    'DataView',
    'Int8Array',
    'Uint8Array',
    'Uint8ClampedArray',
    'Int16Array',
    'Uint16Array',
    'Int32Array',
    'Uint32Array',
    'Float32Array',
    'Float64Array',
    'BigInt64Array',
    'BigUint64Array',
  ]);

  return builtInTypes.has(typeName);
}

/**
 * Check if a command is a common Bash built-in or system command
 */
function isCommonBashCommand(command: string): boolean {
  const commonCommands = new Set([
    'echo',
    'cd',
    'ls',
    'pwd',
    'mkdir',
    'rm',
    'cp',
    'mv',
    'cat',
    'grep',
    'sed',
    'awk',
    'find',
    'chmod',
    'chown',
    'tar',
    'gzip',
    'gunzip',
    'zip',
    'unzip',
    'curl',
    'wget',
    'git',
    'npm',
    'yarn',
    'node',
    'python',
    'pip',
    'docker',
    'kubectl',
    'make',
    'gcc',
    'g++',
    'java',
    'javac',
    'test',
    'export',
    'source',
    'alias',
    'unalias',
    'history',
    'exit',
    'kill',
    'ps',
    'top',
    'df',
    'du',
    'mount',
    'umount',
    'ssh',
    'scp',
    'rsync',
    'ping',
    'netstat',
    'ifconfig',
    'ip',
  ]);

  return commonCommands.has(command);
}

/**
 * Get the location of a specific code example by index
 * Useful for error reporting
 */
export function getExampleLocation(
  markdownPath: string,
  exampleIndex: number
): MarkdownLocation | null {
  const examples = extractCodeExamples(markdownPath);

  if (exampleIndex < 0 || exampleIndex >= examples.length) {
    return null;
  }

  return examples[exampleIndex].location;
}

/**
 * Find code examples that reference a specific symbol
 * @param markdownPath - Path to the Markdown file
 * @param symbolName - Name of the symbol to search for
 * @returns Array of code examples that reference the symbol
 */
export function findExamplesReferencingSymbol(
  markdownPath: string,
  symbolName: string
): CodeExample[] {
  const examples = extractCodeExamples(markdownPath);
  return examples.filter((example) =>
    example.referencedSymbols.includes(symbolName)
  );
}

/**
 * Get statistics about code examples in a Markdown file
 * @param markdownPath - Path to the Markdown file
 * @returns Statistics object
 */
export function getExampleStatistics(markdownPath: string): {
  totalExamples: number;
  byLanguage: Record<string, number>;
  totalSymbols: number;
  uniqueSymbols: number;
} {
  const examples = extractCodeExamples(markdownPath);

  const byLanguage: Record<string, number> = {};
  const allSymbols = new Set<string>();

  let totalSymbols = 0;

  for (const example of examples) {
    // Count by language
    byLanguage[example.language] = (byLanguage[example.language] || 0) + 1;

    // Count symbols
    totalSymbols += example.referencedSymbols.length;
    example.referencedSymbols.forEach((sym) => allSymbols.add(sym));
  }

  return {
    totalExamples: examples.length,
    byLanguage,
    totalSymbols,
    uniqueSymbols: allSymbols.size,
  };
}
