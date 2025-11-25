/**
 * CLI integration tests
 * Tests the command-line interface functionality
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('CLI', () => {
  const cliPath = path.join(__dirname, '../dist/cli.js');
  const testOutputDir = path.join(__dirname, '../test-output');

  beforeAll(() => {
    // Ensure CLI is built
    if (!fs.existsSync(cliPath)) {
      throw new Error(
        'CLI not built. Run "npm run build" before running tests.'
      );
    }

    // Create test output directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test output directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('--help', () => {
    it('should display help information', () => {
      const output = execSync(`node ${cliPath} --help`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('Documentation and test coverage audit tool');
      expect(output).toContain('audit');
      expect(output).toContain('audit:package');
      expect(output).toContain('validate');
      expect(output).toContain('report');
    });
  });

  describe('--version', () => {
    it('should display version information', () => {
      const output = execSync(`node ${cliPath} --version`, {
        encoding: 'utf-8',
      });

      expect(output).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('audit --help', () => {
    it('should display audit command help', () => {
      const output = execSync(`node ${cliPath} audit --help`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('Run a full audit on all packages');
      expect(output).toContain('--root');
    });
  });

  describe('audit:package --help', () => {
    it('should display audit:package command help', () => {
      const output = execSync(`node ${cliPath} audit:package --help`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('Run audit on a single package');
      expect(output).toContain('--root');
    });
  });

  describe('validate --help', () => {
    it('should display validate command help', () => {
      const output = execSync(`node ${cliPath} validate --help`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('Run validation checks for CI/CD');
      expect(output).toContain('--changed');
    });
  });

  describe('report --help', () => {
    it('should display report command help', () => {
      const output = execSync(`node ${cliPath} report --help`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('Generate reports from audit data');
      expect(output).toContain('--input');
      expect(output).toContain('--output');
      expect(output).toContain('--format');
    });
  });

  describe('audit:package', () => {
    it('should handle non-existent package gracefully', () => {
      try {
        execSync(`node ${cliPath} audit:package non-existent-package`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.status).toBe(1);
        expect(error.stderr.toString()).toContain('Package not found');
      }
    });
  });

  describe('report', () => {
    it('should require output path', () => {
      try {
        execSync(`node ${cliPath} report`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.status).toBe(1);
        expect(error.stderr.toString()).toContain('required option');
      }
    });
  });

  describe('global options', () => {
    it('should accept --verbose flag', () => {
      // Just verify the flag is accepted without error
      const output = execSync(`node ${cliPath} --verbose --help`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('Documentation and test coverage audit tool');
    });

    it('should accept --format flag', () => {
      const output = execSync(`node ${cliPath} --format json --help`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('Documentation and test coverage audit tool');
    });

    it('should accept --exclude flag', () => {
      const output = execSync(`node ${cliPath} --exclude pkg1 pkg2 --help`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('Documentation and test coverage audit tool');
    });

    it('should accept threshold flags', () => {
      const output = execSync(
        `node ${cliPath} --statement-threshold 95 --branch-threshold 90 --help`,
        {
          encoding: 'utf-8',
        }
      );

      expect(output).toContain('Documentation and test coverage audit tool');
    });
  });
});
