/**
 * TypeScript parser for extracting exported symbols from source files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { ExportedSymbol } from '../types';

/**
 * Parse TypeScript files in a package and extract all exported symbols
 * @param packagePath - Path to the package directory
 * @returns Array of exported symbols with their metadata
 */
export function parseTypeScriptExports(packagePath: string): ExportedSymbol[] {
  const exports: ExportedSymbol[] = [];
  const srcPath = path.join(packagePath, 'src');

  if (!fs.existsSync(srcPath)) {
    return exports;
  }

  // Find all TypeScript files
  const tsFiles = findTypeScriptFiles(srcPath);

  // Create a TypeScript program
  const program = ts.createProgram(tsFiles, {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    allowJs: true,
    skipLibCheck: true,
    skipDefaultLibCheck: true,
  });

  const checker = program.getTypeChecker();

  // Process each source file
  for (const sourceFile of program.getSourceFiles()) {
    if (
      !sourceFile.fileName.includes('node_modules') &&
      tsFiles.includes(sourceFile.fileName)
    ) {
      const fileExports = extractExportsFromFile(
        sourceFile,
        checker,
        packagePath
      );
      exports.push(...fileExports);
    }
  }

  return exports;
}

/**
 * Find all TypeScript files in a directory recursively
 */
function findTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentPath: string) {
    if (!fs.existsSync(currentPath)) {
      return;
    }

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, dist, and test directories
        if (
          !['node_modules', 'dist', 'tests', 'test', '__tests__'].includes(
            entry.name
          )
        ) {
          traverse(fullPath);
        }
      } else if (
        entry.isFile() &&
        /\.(ts|tsx)$/.test(entry.name) &&
        !entry.name.endsWith('.d.ts')
      ) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Extract exported symbols from a single source file
 */
function extractExportsFromFile(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  packagePath: string
): ExportedSymbol[] {
  const exports: ExportedSymbol[] = [];
  const relativeFilePath = path.relative(packagePath, sourceFile.fileName);

  // Visit each node in the source file
  ts.forEachChild(sourceFile, (node) => {
    // Check if node has export modifier
    if (hasExportModifier(node)) {
      const symbol = extractSymbolFromNode(node, checker, relativeFilePath);
      if (symbol) {
        exports.push(symbol);
      }
    }

    // Handle export declarations (export { foo, bar })
    if (ts.isExportDeclaration(node)) {
      const reExports = handleExportDeclaration(
        node,
        checker,
        sourceFile,
        relativeFilePath
      );
      exports.push(...reExports);
    }

    // Handle export assignments (export = foo)
    if (ts.isExportAssignment(node)) {
      const exportAssignment = handleExportAssignment(
        node,
        checker,
        relativeFilePath
      );
      if (exportAssignment) {
        exports.push(exportAssignment);
      }
    }
  });

  return exports;
}

/**
 * Check if a node has an export modifier
 */
function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }

  const modifiers = ts.getModifiers(node);
  if (!modifiers) {
    return false;
  }

  return modifiers.some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
  );
}

/**
 * Extract symbol information from a node
 */
function extractSymbolFromNode(
  node: ts.Node,
  checker: ts.TypeChecker,
  sourceFile: string
): ExportedSymbol | null {
  // Function declarations
  if (ts.isFunctionDeclaration(node) && node.name) {
    return {
      name: node.name.text,
      type: 'function',
      signature: getFunctionSignature(node, checker),
      sourceFile,
      isDocumented: false,
      hasExample: false,
    };
  }

  // Class declarations
  if (ts.isClassDeclaration(node) && node.name) {
    return {
      name: node.name.text,
      type: 'class',
      signature: getClassSignature(node, checker),
      sourceFile,
      isDocumented: false,
      hasExample: false,
    };
  }

  // Interface declarations
  if (ts.isInterfaceDeclaration(node)) {
    return {
      name: node.name.text,
      type: 'interface',
      signature: getInterfaceSignature(node, checker),
      sourceFile,
      isDocumented: false,
      hasExample: false,
    };
  }

  // Type alias declarations
  if (ts.isTypeAliasDeclaration(node)) {
    return {
      name: node.name.text,
      type: 'type',
      signature: getTypeAliasSignature(node, checker),
      sourceFile,
      isDocumented: false,
      hasExample: false,
    };
  }

  // Variable declarations (const, let, var)
  if (ts.isVariableStatement(node)) {
    const declaration = node.declarationList.declarations[0];
    if (declaration && ts.isIdentifier(declaration.name)) {
      return {
        name: declaration.name.text,
        type: 'const',
        signature: getVariableSignature(declaration, checker),
        sourceFile,
        isDocumented: false,
        hasExample: false,
      };
    }
  }

  return null;
}

/**
 * Handle export declarations (re-exports)
 */
function handleExportDeclaration(
  node: ts.ExportDeclaration,
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  relativeFilePath: string
): ExportedSymbol[] {
  const exports: ExportedSymbol[] = [];

  // Handle named exports: export { foo, bar }
  if (node.exportClause && ts.isNamedExports(node.exportClause)) {
    for (const element of node.exportClause.elements) {
      const name = element.name.text;
      const symbol = checker.getSymbolAtLocation(element.name);

      if (symbol) {
        const type = getSymbolType(symbol, checker);
        exports.push({
          name,
          type,
          signature: getSymbolSignature(symbol, checker, type),
          sourceFile: relativeFilePath,
          isDocumented: false,
          hasExample: false,
        });
      }
    }
  }

  // Handle re-export all: export * from './module'
  if (!node.exportClause && node.moduleSpecifier) {
    // For barrel files, we mark this as a re-export
    // The actual symbols will be picked up from the source files
  }

  return exports;
}

/**
 * Handle export assignments
 */
function handleExportAssignment(
  node: ts.ExportAssignment,
  checker: ts.TypeChecker,
  sourceFile: string
): ExportedSymbol | null {
  if (ts.isIdentifier(node.expression)) {
    const symbol = checker.getSymbolAtLocation(node.expression);
    if (symbol) {
      const type = getSymbolType(symbol, checker);
      return {
        name: node.expression.text,
        type,
        signature: getSymbolSignature(symbol, checker, type),
        sourceFile,
        isDocumented: false,
        hasExample: false,
      };
    }
  }

  return null;
}

/**
 * Get the type of a symbol
 */
function getSymbolType(
  symbol: ts.Symbol,
  _checker: ts.TypeChecker
): 'function' | 'class' | 'interface' | 'type' | 'const' {
  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) {
    return 'const';
  }

  const declaration = declarations[0];

  if (
    ts.isFunctionDeclaration(declaration) ||
    ts.isMethodDeclaration(declaration)
  ) {
    return 'function';
  }
  if (ts.isClassDeclaration(declaration)) {
    return 'class';
  }
  if (ts.isInterfaceDeclaration(declaration)) {
    return 'interface';
  }
  if (ts.isTypeAliasDeclaration(declaration)) {
    return 'type';
  }

  return 'const';
}

/**
 * Get signature for a symbol
 */
function getSymbolSignature(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
  type: 'function' | 'class' | 'interface' | 'type' | 'const'
): string {
  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) {
    return '';
  }

  const declaration = declarations[0];

  switch (type) {
    case 'function':
      if (ts.isFunctionDeclaration(declaration)) {
        return getFunctionSignature(declaration, checker);
      }
      break;
    case 'class':
      if (ts.isClassDeclaration(declaration)) {
        return getClassSignature(declaration, checker);
      }
      break;
    case 'interface':
      if (ts.isInterfaceDeclaration(declaration)) {
        return getInterfaceSignature(declaration, checker);
      }
      break;
    case 'type':
      if (ts.isTypeAliasDeclaration(declaration)) {
        return getTypeAliasSignature(declaration, checker);
      }
      break;
  }

  return checker.typeToString(
    checker.getTypeOfSymbolAtLocation(symbol, declaration)
  );
}

/**
 * Get function signature
 */
function getFunctionSignature(
  node: ts.FunctionDeclaration,
  _checker: ts.TypeChecker
): string {
  const name = node.name?.text || 'anonymous';
  const params = node.parameters
    .map((param) => {
      const paramName = param.name.getText();
      const paramType = param.type ? param.type.getText() : 'any';
      return `${paramName}: ${paramType}`;
    })
    .join(', ');

  const returnType = node.type ? node.type.getText() : 'void';

  return `function ${name}(${params}): ${returnType}`;
}

/**
 * Get class signature
 */
function getClassSignature(
  node: ts.ClassDeclaration,
  _checker: ts.TypeChecker
): string {
  const name = node.name?.text || 'Anonymous';
  const heritage = node.heritageClauses
    ?.map((clause) => {
      const keyword =
        clause.token === ts.SyntaxKind.ExtendsKeyword
          ? 'extends'
          : 'implements';
      const types = clause.types.map((t) => t.expression.getText()).join(', ');
      return `${keyword} ${types}`;
    })
    .join(' ');

  return heritage ? `class ${name} ${heritage}` : `class ${name}`;
}

/**
 * Get interface signature
 */
function getInterfaceSignature(
  node: ts.InterfaceDeclaration,
  _checker: ts.TypeChecker
): string {
  const name = node.name.text;
  const heritage = node.heritageClauses
    ?.map((clause) => {
      const types = clause.types.map((t) => t.expression.getText()).join(', ');
      return `extends ${types}`;
    })
    .join(' ');

  return heritage ? `interface ${name} ${heritage}` : `interface ${name}`;
}

/**
 * Get type alias signature
 */
function getTypeAliasSignature(
  node: ts.TypeAliasDeclaration,
  _checker: ts.TypeChecker
): string {
  const name = node.name.text;
  const type = node.type.getText();
  return `type ${name} = ${type}`;
}

/**
 * Get variable signature
 */
function getVariableSignature(
  node: ts.VariableDeclaration,
  _checker: ts.TypeChecker
): string {
  const name = node.name.getText();
  const type = node.type ? node.type.getText() : 'unknown';
  return `const ${name}: ${type}`;
}
