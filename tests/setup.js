/**
 * Jest test setup file
 * Global test configuration and utilities
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Global test utilities
global.testUtils = {
  /**
   * Create a delay for async testing
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} - Promise that resolves after delay
   */
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate test event data
   * @param {string} tenantId - Tenant identifier
   * @param {string} message - Event message
   * @returns {Object} - Test event object
   */
  createTestEvent: (tenantId = 'tenant_a', message = 'Test event message') => ({
    tenant_id: tenantId,
    message: message
  }),

  /**
   * Generate test tenant IDs
   * @returns {Array} - Array of test tenant IDs
   */
  getTestTenants: () => ['tenant_a', 'tenant_b'],

  /**
   * Clean up test data
   */
  cleanup: () => {
    // Reset any global state if needed
  }
};

// Console override for testing (suppress logs in test output)
const originalConsole = { ...console };

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

// Global test hooks
beforeEach(() => {
  // Reset any mocks or state before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  global.testUtils.cleanup();
});
