/**
 * Core type definitions for the audit tool
 */

export interface PackageMetadata {
  name: string;
  version: string;
  path: string;
  dependencies: string[];
  devDependencies: string[];
  exports: ExportedSymbol[];
  tests: TestFile[];
  readme: string;
}

export interface ExportedSymbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'const';
  signature: string;
  sourceFile: string;
  isDocumented: boolean;
  hasExample: boolean;
}

export interface TestFile {
  path: string;
  imports: string[];
}

export interface DocumentedSymbol {
  name: string;
  description: string;
  location: MarkdownLocation;
  hasUsageExample: boolean;
}

export interface MarkdownLocation {
  file: string;
  line: number;
  column: number;
}

export interface CodeExample {
  code: string;
  language: string;
  location: MarkdownLocation;
  referencedSymbols: string[];
  hasTest: boolean;
}

export interface CrossReference {
  sourcePackage: string;
  targetPackage: string;
  targetSymbol?: string;
  location: MarkdownLocation;
  isValid: boolean;
}

export interface ConfigOption {
  name: string;
  type: string;
  defaultValue?: string;
  description: string;
  isDocumented: boolean;
}

export interface PackageDocumentation {
  packageName: string;
  exports: ExportedSymbol[];
  documentedSymbols: DocumentedSymbol[];
  examples: CodeExample[];
  crossReferences: CrossReference[];
  configOptions: ConfigOption[];
}

export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
  meetsThreshold: boolean;
}

export interface FileCoverage {
  path: string;
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  lines: CoverageMetric;
}

export interface UntestedExport {
  symbol: ExportedSymbol;
  reason: string;
}

export interface CoverageReport {
  packageName: string;
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  lines: CoverageMetric;
  files: FileCoverage[];
  untestedExports: UntestedExport[];
}

export interface TestQualityReport {
  totalTests: number;
  testsWithErrorHandling: number;
  testsWithEdgeCases: number;
  integrationTests: number;
  exampleTests: number;
}

export interface ValidationError {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  location?: MarkdownLocation | string;
  recommendation?: string;
}

export interface ValidationWarning {
  type: string;
  message: string;
  location?: MarkdownLocation | string;
  recommendation?: string;
}

export interface ValidationMetrics {
  documentationCompleteness: number;
  testCoverage: number;
  exampleCoverage: number;
  crossReferenceValidity: number;
}

export interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metrics: ValidationMetrics;
}

export interface PackageAuditResult {
  packageName: string;
  documentation: PackageDocumentation;
  coverage: CoverageReport;
  quality: TestQualityReport;
  issues: ValidationError[];
}

export interface AuditSummary {
  totalPackages: number;
  packagesWithIssues: number;
  overallDocumentationScore: number;
  overallCoverageScore: number;
  criticalIssues: number;
  warnings: number;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  message: string;
  affectedPackages: string[];
  actionItems: string[];
}

export interface AuditReport {
  timestamp: Date;
  packages: PackageAuditResult[];
  summary: AuditSummary;
  recommendations: Recommendation[];
}

// Cross-package analysis types
export interface PackageNode {
  name: string;
  path: string;
  version: string;
  dependencies: string[];
  devDependencies: string[];
}

export interface Dependency {
  source: string;
  target: string;
  type: 'dependency' | 'devDependency';
}

export interface IntegrationPoint {
  sourcePackage: string;
  targetPackage: string;
  type: 'api' | 'type' | 'utility' | 'config';
  isDocumented: boolean;
  hasTests: boolean;
  examples: string[];
}

export interface PackageDependencyGraph {
  packages: PackageNode[];
  dependencies: Dependency[];
  integrationPoints: IntegrationPoint[];
}

export interface CompatibilityTest {
  name: string;
  passed: boolean;
  description: string;
}

export interface CompatibilityIssue {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  affectedPackages: string[];
}

export interface CompatibilityReport {
  eciesLibVersion: string;
  nodeEciesLibVersion: string;
  binaryCompatible: boolean;
  compatibilityTests: CompatibilityTest[];
  issues: CompatibilityIssue[];
}

export interface DocumentedIntegration {
  sourcePackage: string;
  targetPackage: string;
  description: string;
  location: MarkdownLocation;
  hasExample: boolean;
  hasTest: boolean;
}
