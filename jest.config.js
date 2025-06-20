/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.spec.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/main.ts',
    '!src/utils/instrumentSentry.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleNameMapper: {
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@cache/(.*)$': '<rootDir>/src/cache/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@exceptions$': '<rootDir>/src/exceptions',
    '^@libs/(.*)$': '<rootDir>/src/libs/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@validate/(.*)$': '<rootDir>/src/validate/$1'
  },
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
