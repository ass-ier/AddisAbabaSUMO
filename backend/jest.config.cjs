/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/docs/**',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: '<rootDir>/tests-report',
        filename: 'report.html',
        expand: true,
        openReport: false,
        inlineSource: false
      }
    ]
  ],
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1'
  }
};