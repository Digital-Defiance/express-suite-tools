# Audit Tool - Remaining Issues & Fix Plan

## Current Status ✅

**Working**: 245 tests passing in 36 seconds
- 14 test suites fully functional
- All core functionality tested
- Ready for development and CI/CD

## Remaining Issues ⚠️

**Broken**: 3 test files hang indefinitely (~47 tests blocked)

### 1. `cli.test.ts` - 8 tests
**Issue**: Hangs even after build
**Likely Cause**: CLI process not terminating, waiting for stdin/stdout
**Impact**: Cannot verify CLI works correctly

### 2. `orchestrator.test.ts` - 17 tests  
**Issue**: Hangs when running full audits
**Likely Cause**: Calls TypeScript parser repeatedly on generated packages
**Impact**: Cannot verify end-to-end audit workflow

### 3. `export-validator.test.ts` - 22 tests
**Issue**: Hangs on basic validation tests
**Likely Cause**: Infinite loop or blocking call in validation logic
**Impact**: Cannot verify export documentation validation

## Fix Plan

A comprehensive spec has been created at `.kiro/specs/fix-audit-hanging-tests/`

### Documents Created:
1. **requirements.md** - Detailed requirements and acceptance criteria
2. **design.md** - Investigation strategy and implementation approach
3. **tasks.md** - Step-by-step tasks with time estimates

### Approach Summary:

**Phase 1: Investigation (1.5 hours)**
- Add timeouts to identify which specific tests hang
- Add logging to trace execution
- Profile performance to find bottlenecks
- Document root causes

**Phase 2: Implementation (6-8 hours)**
- Create test fixtures to avoid generating packages
- Mock expensive operations (TypeScript parser)
- Refactor CLI for testability
- Add timeout protection to validation
- Fix any infinite loops found

**Phase 3: Verification (1 hour)**
- Run full test suite
- Verify all ~292 tests pass
- Verify performance targets met
- Update documentation

### Key Design Decisions:

1. **Mock Heavy Operations** - Mock TypeScript parser in fast mode for speed
2. **Use Test Fixtures** - Pre-built test packages instead of generating on-the-fly
3. **Direct Function Testing** - Test CLI functions directly instead of spawning processes
4. **Timeout Protection** - Add explicit timeouts to prevent hangs

### Expected Outcomes:

After fixes:
- ✅ All 292 tests passing
- ✅ Fast mode: < 2 minutes (currently 36 seconds for 245 tests)
- ✅ Full mode: < 5 minutes
- ✅ No hangs or timeouts
- ✅ CI/CD pipeline works

## Estimated Effort

**Total Time**: 10-12 hours
- Investigation: 1.5 hours
- Implementation: 6-8 hours
- Verification: 1 hour
- Documentation: 0.5 hours

## Priority

**HIGH** - These tests verify critical functionality:
- CLI commands work correctly
- Full audit workflow functions
- Export validation catches issues

Without these tests, we cannot be confident that:
- The CLI tool works for end users
- The audit process completes successfully
- Export documentation is properly validated

## Next Steps

1. Review the spec at `.kiro/specs/fix-audit-hanging-tests/`
2. Start with Phase 1 (Investigation) to confirm root causes
3. Implement fixes based on findings
4. Verify all tests pass
5. Update documentation

## Investment Justification

**Already Invested**: Significant effort optimizing test suite
**Remaining Work**: 10-12 hours to complete the job
**Value**: 
- Full test coverage (292 vs 245 tests)
- Confidence in production deployments
- Verification of critical user-facing features
- Complete CI/CD pipeline

The 3 broken tests represent ~16% of the test suite and cover critical functionality. Completing this work ensures the significant investment already made delivers full value.
