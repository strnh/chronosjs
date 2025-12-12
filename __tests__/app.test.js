const app = require('../src/app');

describe('App', () => {
  test('should export express app', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
  });
});
