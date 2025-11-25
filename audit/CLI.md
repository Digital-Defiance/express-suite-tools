# Audit Tool CLI

Command-line interface for the Express Suite documentation and test coverage audit tool.

## Installation

```bash
cd tools/audit
npm install
npm run build
```

## Usage

The audit tool provides several commands for analyzing packages in the Express Suite monorepo.

### Global Options

These options can be used with any command:

- `--no-coverage` - Skip coverage analysis (faster but less comprehensive)
- `--no-cross-package` - Skip cross-package analysis
- `--no-examples` - Skip example validation
- `--no-references` - Skip cross-reference validation
- `-v, --verbose` - Enable verbose output
- `-o, --output <path>` - Output file path for report
- `-f, --format <format>` - Output format: `console`, `json`, or `html` (default: `console`)
- `-e, --exclude <packages...>` - Packages to exclude from audit
- `--statement-threshold <number>` - Statement coverage threshold percentage (default: 90)
- `--branch-threshold <number>` - Branch coverage threshold percentage (default: 85)

### Commands

#### `audit`

Run a full audit on all packages in the monorepo.

```bash
# Run full audit with console output
npm run audit

# Run audit and save HTML report
npm run audit -- -o report.html -f html

# Run audit excluding specific packages
npm run audit -- -e digitaldefiance-mongoose-types

# Run audit with verbose output
npm run audit -- -v

# Run audit without coverage analysis (faster)
npm run audit -- --no-coverage
```

**Options:**
- `-r, --root <path>` - Monorepo root directory (auto-detected if not specified)

**Exit Codes:**
- `0` - Success (no critical issues)
- `1` - Failure (critical issues found or error occurred)

#### `audit:package`

Run audit on a single package.

```bash
# Audit a specific package by name
npm run audit:package digitaldefiance-ecies-lib

# Audit a package by path
npm run audit:package -- packages/digitaldefiance-ecies-lib

# Audit and save JSON report
npm run audit:package digitaldefiance-i18n-lib -- -o report.json -f json
```

**Arguments:**
- `<package>` - Package name or path to package directory

**Options:**
- `-r, --root <path>` - Monorepo root directory

**Exit Codes:**
- `0` - Success (no critical issues)
- `1` - Failure (critical issues found or error occurred)

#### `validate`

Run validation checks for CI/CD. This command is designed for continuous integration pipelines and will fail if critical issues are found.

```bash
# Validate all packages
npm run validate

# Validate only changed files (for incremental CI)
npm run validate -- --changed src/file1.ts src/file2.ts

# Validate and save JSON report for CI artifacts
npm run validate -- -o validation-report.json -f json
```

**Options:**
- `-r, --root <path>` - Monorepo root directory
- `--changed <files...>` - Only validate packages affected by these changed files

**Exit Codes:**
- `0` - Validation passed (no critical issues)
- `1` - Validation failed (critical issues found)

**CI/CD Integration Example:**

```yaml
# GitHub Actions example
- name: Run audit validation
  run: |
    cd tools/audit
    npm run build
    npm run validate -- -o validation-report.json -f json
  
- name: Upload validation report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: validation-report
    path: tools/audit/validation-report.json
```

#### `report`

Generate reports from audit data. Can either run a new audit or load existing audit data.

```bash
# Generate HTML report from new audit
npm run report -- -o report.html -f html

# Generate HTML report from existing JSON data
npm run report -- -i audit-data.json -o report.html -f html

# Generate JSON report
npm run report -- -o report.json -f json
```

**Options:**
- `-r, --root <path>` - Monorepo root directory
- `-i, --input <path>` - Input JSON report file (if not specified, runs new audit)
- `-o, --output <path>` - Output file path (required)
- `-f, --format <format>` - Output format: `json` or `html` (default: `html`)

## Examples

### Basic Audit

Run a basic audit on all packages:

```bash
cd tools/audit
npm run build
npm run audit
```

### Comprehensive Audit with Report

Run a comprehensive audit and generate an HTML report:

```bash
npm run audit -- -v -o audit-report.html -f html
```

### Quick Validation (No Coverage)

Run a quick validation without coverage analysis:

```bash
npm run audit -- --no-coverage
```

### CI/CD Validation

Validate only changed packages in CI:

```bash
# Get changed files from git
CHANGED_FILES=$(git diff --name-only HEAD~1)

# Run validation on changed files
npm run validate -- --changed $CHANGED_FILES -o validation.json -f json
```

### Package-Specific Audit

Audit a single package with detailed output:

```bash
npm run audit:package digitaldefiance-ecies-lib -- -v -o ecies-audit.html -f html
```

### Generate Report from Existing Data

Generate an HTML report from previously saved JSON data:

```bash
npm run report -- -i previous-audit.json -o report.html -f html
```

## Output Formats

### Console Output

Default format. Displays results in the terminal with colored formatting.

```bash
npm run audit
```

### JSON Output

Machine-readable format suitable for programmatic processing or CI/CD integration.

```bash
npm run audit -- -o report.json -f json
```

JSON structure:
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "packages": [...],
  "summary": {
    "totalPackages": 8,
    "packagesWithIssues": 3,
    "overallDocumentationScore": 85.5,
    "overallCoverageScore": 78.2,
    "criticalIssues": 5,
    "warnings": 12
  },
  "recommendations": [...]
}
```

### HTML Output

Human-readable format with visual charts and detailed issue breakdowns.

```bash
npm run audit -- -o report.html -f html
```

## Configuration

### Coverage Thresholds

Customize coverage thresholds:

```bash
npm run audit -- --statement-threshold 95 --branch-threshold 90
```

### Excluding Packages

Exclude specific packages from audit:

```bash
npm run audit -- -e digitaldefiance-mongoose-types digitaldefiance-express-suite-starter
```

### Selective Analysis

Disable specific analysis phases:

```bash
# Skip coverage analysis (faster)
npm run audit -- --no-coverage

# Skip cross-package analysis
npm run audit -- --no-cross-package

# Skip example validation
npm run audit -- --no-examples

# Skip cross-reference validation
npm run audit -- --no-references
```

## Troubleshooting

### "Package not found" Error

If you get a "Package not found" error, ensure:
1. The package name is correct
2. The package exists in the `packages/` directory
3. The package has a `package.json` file

### "CLI not built" Error

Run the build command before using the CLI:

```bash
npm run build
```

### Permission Denied

Make the CLI executable:

```bash
chmod +x dist/cli.js
```

### Out of Memory

For large monorepos, you may need to increase Node's memory limit:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run audit
```

## Exit Codes

All commands use standard exit codes:

- `0` - Success
- `1` - Failure (critical issues or error)

This makes the tool suitable for CI/CD pipelines where non-zero exit codes indicate build failures.
