/**
 * Jest setup file for InvPatrimonio tests
 */

// Setup environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

// Global test timeout
jest.setTimeout(10000);