import { SecurityTestSuite } from './utils/security-test';

// Run all security tests
console.log('🔒 Running Security Tests...\n');

const results = SecurityTestSuite.runAllTests();

// Display XSS Test Results
console.log('📋 XSS Protection Tests');
console.log('='.repeat(40));
results.xssTests.results.forEach(result => {
  console.log(`${result.passed ? '✅' : '❌'} ${result.test}`);
  if (!result.passed) {
    console.log(`   Details: ${result.details}`);
  }
});
console.log(`\nXSS Tests: ${results.xssTests.passed}/${results.xssTests.passed + results.xssTests.failed} passed\n`);

// Display Password Test Results
console.log('🔐 Password Validation Tests');
console.log('='.repeat(40));
results.passwordTests.results.forEach(result => {
  console.log(`${result.passed ? '✅' : '❌'} ${result.test}`);
  if (!result.passed) {
    console.log(`   Details: ${result.details}`);
  }
});
console.log(`\nPassword Tests: ${results.passwordTests.passed}/${results.passwordTests.passed + results.passwordTests.failed} passed\n`);

// Display Sanitization Test Results
console.log('🧹 Input Sanitization Tests');
console.log('='.repeat(40));
results.sanitizationTests.results.forEach(result => {
  console.log(`${result.passed ? '✅' : '❌'} ${result.test}`);
  if (!result.passed) {
    console.log(`   Details: ${result.details}`);
  }
});
console.log(`\nSanitization Tests: ${results.sanitizationTests.passed}/${results.sanitizationTests.passed + results.sanitizationTests.failed} passed\n`);

// Display Summary
console.log('📊 SECURITY TEST SUMMARY');
console.log('='.repeat(40));
console.log(`Total Tests Passed: ${results.summary.totalPassed}`);
console.log(`Total Tests Failed: ${results.summary.totalFailed}`);
console.log(`Overall Status: ${results.summary.overallPassed ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`Security Score: ${Math.round((results.summary.totalPassed / (results.summary.totalPassed + results.summary.totalFailed)) * 100)}/100`);

if (results.summary.overallPassed) {
  console.log('\n🎉 ALL SECURITY TESTS PASSED! Your application is secure.');
} else {
  console.log('\n⚠️  Some security tests failed. Please review the details above.');
} 