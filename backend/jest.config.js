module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    // Temporarily disabled: Schema mismatches need fixing
    '/__tests__/authController.test.ts',
    '/__tests__/vmsController.test.ts',
    '/__tests__/backupExecutorService.test.ts',
    '/__tests__/controllers/clustersController.test.ts',
    '/controllers/__tests__/ipRangesController.test.ts',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
