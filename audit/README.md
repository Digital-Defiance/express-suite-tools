# Express Suite Audit Tool

Documentation and test coverage audit tool for the Express Suite monorepo.

## Overview

This tool analyzes all packages in the Express Suite monorepo to ensure:
- Complete documentation of all exported functionality
- Comprehensive test coverage
- Valid cross-package references
- Working code examples

## Installation

```bash
cd tools/audit
yarn install
yarn build
```

## Usage

### Run Full Audit

```bash
yarn audit
```

### Audit Single Package

```bash
yarn audit:package <package-name>
```

### Run Validation (for CI/CD)

```bash
yarn validate
```

## Project Structure

```
tools/audit/
├── src/
│   ├── analyzers/       # Analysis components
│   ├── parsers/         # TypeScript and Markdown parsers
│   ├── validators/      # Validation logic
│   ├── reporters/       # Report generators
│   ├── orchestrator.ts  # Main orchestration logic
│   ├── cli.ts          # CLI interface
│   ├── types.ts        # Type definitions
│   └── index.ts        # Main entry point
├── tests/
│   ├── analyzers/      # Analyzer tests
│   ├── parsers/        # Parser tests
│   ├── validators/     # Validator tests
│   └── integration/    # Integration tests
├── config/             # Configuration files
└── dist/              # Compiled output
```

## Development

### Build

```bash
yarn build
```

### Test

```bash
yarn test
```

### Watch Mode

```bash
yarn build:watch
yarn test:watch
```

## Configuration

Configuration files can be placed in the `config/` directory to customize:
- Coverage thresholds
- Documentation requirements
- Validation rules
- Report formats

## License

MIT
