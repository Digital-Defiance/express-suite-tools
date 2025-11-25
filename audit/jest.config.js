module.exports = {
  displayName: 'audit-tool',
  testEnvironment: 'node',
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
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
  },
  testMatch: ['**/tests/**/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(remark|remark-parse|unified|unist-util-visit|unist-util-is|unist-util-visit-parents|mdast-util-from-markdown|mdast-util-to-string|mdast-util-to-markdown|mdast-util-gfm|micromark|micromark-util-.*|decode-named-character-reference|character-entities.*|vfile|vfile-message|bail|is-plain-obj|trough|zwitch|longest-streak|markdown-table|ccount|escape-string-regexp|devlop)/)',
  ],
};
