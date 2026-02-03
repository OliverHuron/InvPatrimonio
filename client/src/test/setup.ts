import '@testing-library/jest-dom'

// Setup for tests
global.ResizeObserver = class ResizeObserver {
  constructor(cb: any) {}
  observe() {}
  disconnect() {}
  unobserve() {}
};