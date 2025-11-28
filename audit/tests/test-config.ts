/**
 * Test configuration for property-based tests
 * Adjust NUM_RUNS based on environment (CI vs local)
 */

// Use fewer runs in CI or when FAST_TESTS is set
const isFastMode =
  process.env.FAST_TESTS === 'true' || process.env.CI === 'true';

export const PROPERTY_TEST_CONFIG = {
  // More runs for simple, fast tests (no I/O)
  SIMPLE: isFastMode ? 20 : 100,

  // Standard number of runs for most property tests
  STANDARD: isFastMode ? 10 : 50,

  // Fewer runs for expensive tests (file system operations)
  EXPENSIVE: isFastMode ? 5 : 20,

  // Very few runs for very expensive tests (TypeScript compiler, complex parsing)
  VERY_EXPENSIVE: isFastMode ? 1 : 10,
};
