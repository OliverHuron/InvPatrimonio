module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts', '**/*.test.js'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
  ],
  setupFiles: ['<rootDir>/test/jest.env.js'],
  verbose: true,
  bail: false,
  forceExit: true,
  detectOpenHandles: true
};