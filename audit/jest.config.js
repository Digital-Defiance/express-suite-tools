module.exports = {
  displayName: 'audit-tool',
  testEnvironment: 'node',
  forceExit: true,
  detectOpenHandles: false,
  maxWorkers: 1,
  testTimeout: 5000,
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
  transformIgnorePatterns: [
    'node_modules/(?!(remark|remark-parse|unified|unist-util-visit|unist-util-is|unist-util-visit-parents|mdast-util-from-markdown|mdast-util-to-string|mdast-util-to-markdown|mdast-util-gfm|micromark|micromark-util-.*|decode-named-character-reference|character-entities.*|vfile|vfile-message|bail|is-plain-obj|trough|zwitch|longest-streak|markdown-table|ccount|escape-string-regexp|devlop)/)',
  ],
};
