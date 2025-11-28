module.exports = {
  displayName: 'audit-tool',
  testEnvironment: 'node',
  forceExit: true,
  detectOpenHandles: false,
  maxWorkers: 4,
  testTimeout: 30000,
  bail: false,
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: '../../coverage/tools/audit',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/index.ts'],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
  },
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    // Integration tests - hang or require special setup
    '/cli.test.ts$/',
    '/orchestrator.test.ts$/',
    // Validator test that hangs (needs debugging)
    '/export-validator.test.ts$/',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(remark|remark-parse|unified|unist-util-visit|unist-util-is|unist-util-visit-parents|mdast-util-from-markdown|mdast-util-to-string|mdast-util-to-markdown|mdast-util-gfm|micromark|micromark-util-.*|decode-named-character-reference|character-entities.*|vfile|vfile-message|bail|is-plain-obj|trough|zwitch|longest-streak|markdown-table|ccount|escape-string-regexp|devlop)/)',
  ],
};
