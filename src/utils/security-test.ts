import { XSSProtection, sanitizeInput, sanitizeHTML, validatePassword } from './security';

/**
 * Comprehensive Security Test Suite
 * Tests XSS protection and other security measures
 */
export class SecurityTestSuite {
  
  /**
   * Test XSS protection with various attack vectors
   */
  static testXSSProtection(): { passed: number; failed: number; results: Array<{ test: string; passed: boolean; details: string }> } {
    const results: Array<{ test: string; passed: boolean; details: string }> = [];
    let passed = 0;
    let failed = 0;

    // Test 1: Basic XSS attack
    const xssAttack1 = '<script>alert("xss")</script>';
    const sanitized1 = XSSProtection.sanitizeText(xssAttack1);
    const test1Passed = !sanitized1.includes('<script>') && !sanitized1.includes('alert');
    results.push({
      test: 'Basic XSS Script Tag',
      passed: test1Passed,
      details: `Input: ${xssAttack1}, Output: ${sanitized1}`
    });
    test1Passed ? passed++ : failed++;

    // Test 2: Event handler XSS
    const xssAttack2 = '<img src="x" onerror="alert(\'xss\')">';
    const sanitized2 = XSSProtection.sanitizeText(xssAttack2);
    const test2Passed = !sanitized2.includes('onerror') && !sanitized2.includes('alert');
    results.push({
      test: 'Event Handler XSS',
      passed: test2Passed,
      details: `Input: ${xssAttack2}, Output: ${sanitized2}`
    });
    test2Passed ? passed++ : failed++;

    // Test 3: JavaScript protocol XSS
    const xssAttack3 = '<a href="javascript:alert(\'xss\')">Click me</a>';
    const sanitized3 = XSSProtection.sanitizeText(xssAttack3);
    const test3Passed = !sanitized3.includes('javascript:') && !sanitized3.includes('alert');
    results.push({
      test: 'JavaScript Protocol XSS',
      passed: test3Passed,
      details: `Input: ${xssAttack3}, Output: ${sanitized3}`
    });
    test3Passed ? passed++ : failed++;

    // Test 4: HTML encoding bypass
    const xssAttack4 = '&lt;script&gt;alert("xss")&lt;/script&gt;';
    const sanitized4 = XSSProtection.sanitizeText(xssAttack4);
    const test4Passed = !sanitized4.includes('script') && !sanitized4.includes('alert');
    results.push({
      test: 'HTML Encoding Bypass',
      passed: test4Passed,
      details: `Input: ${xssAttack4}, Output: ${sanitized4}`
    });
    test4Passed ? passed++ : failed++;

    // Test 5: Unicode XSS
    const xssAttack5 = '\u003Cscript\u003Ealert("xss")\u003C/script\u003E';
    const sanitized5 = XSSProtection.sanitizeText(xssAttack5);
    const test5Passed = !sanitized5.includes('script') && !sanitized5.includes('alert');
    results.push({
      test: 'Unicode XSS',
      passed: test5Passed,
      details: `Input: ${xssAttack5}, Output: ${sanitized5}`
    });
    test5Passed ? passed++ : failed++;

    // Test 6: Safe HTML preservation
    const safeHTML = '<strong>Bold text</strong> and <em>italic text</em>';
    const sanitized6 = XSSProtection.sanitizeHTML(safeHTML);
    const test6Passed = sanitized6.includes('<strong>') && sanitized6.includes('<em>') && 
                       sanitized6.includes('Bold text') && sanitized6.includes('italic text');
    results.push({
      test: 'Safe HTML Preservation',
      passed: test6Passed,
      details: `Input: ${safeHTML}, Output: ${sanitized6}`
    });
    test6Passed ? passed++ : failed++;

    return { passed, failed, results };
  }

  /**
   * Test password validation
   */
  static testPasswordValidation(): { passed: number; failed: number; results: Array<{ test: string; passed: boolean; details: string }> } {
    const results: Array<{ test: string; passed: boolean; details: string }> = [];
    let passed = 0;
    let failed = 0;

    // Test 1: Valid password
    const validPassword = 'StrongP@ss123';
    const validResult = validatePassword(validPassword);
    const test1Passed = validResult.isValid && validResult.errors.length === 0;
    results.push({
      test: 'Valid Password',
      passed: test1Passed,
      details: `Password: ${validPassword}, Valid: ${validResult.isValid}, Errors: ${validResult.errors.join(', ')}`
    });
    test1Passed ? passed++ : failed++;

    // Test 2: Weak password (too short)
    const weakPassword1 = 'weak';
    const weakResult1 = validatePassword(weakPassword1);
    const test2Passed = !weakResult1.isValid && weakResult1.errors.includes('Password must be at least 8 characters long');
    results.push({
      test: 'Weak Password - Too Short',
      passed: test2Passed,
      details: `Password: ${weakPassword1}, Valid: ${weakResult1.isValid}, Errors: ${weakResult1.errors.join(', ')}`
    });
    test2Passed ? passed++ : failed++;

    // Test 3: Weak password (no uppercase)
    const weakPassword2 = 'weakpassword123!';
    const weakResult2 = validatePassword(weakPassword2);
    const test3Passed = !weakResult2.isValid && weakResult2.errors.includes('Password must contain at least one uppercase letter');
    results.push({
      test: 'Weak Password - No Uppercase',
      passed: test3Passed,
      details: `Password: ${weakPassword2}, Valid: ${weakResult2.isValid}, Errors: ${weakResult2.errors.join(', ')}`
    });
    test3Passed ? passed++ : failed++;

    // Test 4: Weak password (no special character)
    const weakPassword3 = 'WeakPassword123';
    const weakResult3 = validatePassword(weakPassword3);
    const test4Passed = !weakResult3.isValid && weakResult3.errors.includes('Password must contain at least one special character');
    results.push({
      test: 'Weak Password - No Special Character',
      passed: test4Passed,
      details: `Password: ${weakPassword3}, Valid: ${weakResult3.isValid}, Errors: ${weakResult3.errors.join(', ')}`
    });
    test4Passed ? passed++ : failed++;

    return { passed, failed, results };
  }

  /**
   * Test input sanitization
   */
  static testInputSanitization(): { passed: number; failed: number; results: Array<{ test: string; passed: boolean; details: string }> } {
    const results: Array<{ test: string; passed: boolean; details: string }> = [];
    let passed = 0;
    let failed = 0;

    // Test 1: SQL Injection attempt
    const sqlInjection = "'; DROP TABLE users; --";
    const sanitized1 = sanitizeInput(sqlInjection);
    const test1Passed = sanitized1 === sqlInjection; // Should preserve text but be safe
    results.push({
      test: 'SQL Injection Sanitization',
      passed: test1Passed,
      details: `Input: ${sqlInjection}, Output: ${sanitized1}`
    });
    test1Passed ? passed++ : failed++;

    // Test 2: HTML injection
    const htmlInjection = '<div>Hello</div><script>alert("xss")</script>';
    const sanitized2 = sanitizeInput(htmlInjection);
    const test2Passed = !sanitized2.includes('<script>') && !sanitized2.includes('alert');
    results.push({
      test: 'HTML Injection Sanitization',
      passed: test2Passed,
      details: `Input: ${htmlInjection}, Output: ${sanitized2}`
    });
    test2Passed ? passed++ : failed++;

    // Test 3: Normal text preservation
    const normalText = 'This is normal text with numbers 123 and symbols @#$%';
    const sanitized3 = sanitizeInput(normalText);
    const test3Passed = sanitized3 === normalText;
    results.push({
      test: 'Normal Text Preservation',
      passed: test3Passed,
      details: `Input: ${normalText}, Output: ${sanitized3}`
    });
    test3Passed ? passed++ : failed++;

    return { passed, failed, results };
  }

  /**
   * Run all security tests
   */
  static runAllTests(): {
    xssTests: { passed: number; failed: number; results: Array<{ test: string; passed: boolean; details: string }> };
    passwordTests: { passed: number; failed: number; results: Array<{ test: string; passed: boolean; details: string }> };
    sanitizationTests: { passed: number; failed: number; results: Array<{ test: string; passed: boolean; details: string }> };
    summary: { totalPassed: number; totalFailed: number; overallPassed: boolean };
  } {
    const xssTests = this.testXSSProtection();
    const passwordTests = this.testPasswordValidation();
    const sanitizationTests = this.testInputSanitization();

    const totalPassed = xssTests.passed + passwordTests.passed + sanitizationTests.passed;
    const totalFailed = xssTests.failed + passwordTests.failed + sanitizationTests.failed;

    return {
      xssTests,
      passwordTests,
      sanitizationTests,
      summary: {
        totalPassed,
        totalFailed,
        overallPassed: totalFailed === 0
      }
    };
  }

  /**
   * Generate security report
   */
  static generateSecurityReport(): string {
    const results = this.runAllTests();
    
    let report = '🔒 SECURITY TEST REPORT\n';
    report += '='.repeat(50) + '\n\n';
    
    // XSS Tests
    report += '📋 XSS Protection Tests\n';
    report += '-'.repeat(30) + '\n';
    results.xssTests.results.forEach(result => {
      report += `${result.passed ? '✅' : '❌'} ${result.test}\n`;
      if (!result.passed) {
        report += `   Details: ${result.details}\n`;
      }
    });
    report += `\nXSS Tests: ${results.xssTests.passed}/${results.xssTests.passed + results.xssTests.failed} passed\n\n`;
    
    // Password Tests
    report += '🔐 Password Validation Tests\n';
    report += '-'.repeat(30) + '\n';
    results.passwordTests.results.forEach(result => {
      report += `${result.passed ? '✅' : '❌'} ${result.test}\n`;
      if (!result.passed) {
        report += `   Details: ${result.details}\n`;
      }
    });
    report += `\nPassword Tests: ${results.passwordTests.passed}/${results.passwordTests.passed + results.passwordTests.failed} passed\n\n`;
    
    // Sanitization Tests
    report += '🧹 Input Sanitization Tests\n';
    report += '-'.repeat(30) + '\n';
    results.sanitizationTests.results.forEach(result => {
      report += `${result.passed ? '✅' : '❌'} ${result.test}\n`;
      if (!result.passed) {
        report += `   Details: ${result.details}\n`;
      }
    });
    report += `\nSanitization Tests: ${results.sanitizationTests.passed}/${results.sanitizationTests.passed + results.sanitizationTests.failed} passed\n\n`;
    
    // Summary
    report += '📊 SUMMARY\n';
    report += '-'.repeat(30) + '\n';
    report += `Total Tests Passed: ${results.summary.totalPassed}\n`;
    report += `Total Tests Failed: ${results.summary.totalFailed}\n`;
    report += `Overall Status: ${results.summary.overallPassed ? '✅ PASSED' : '❌ FAILED'}\n`;
    
    return report;
  }
}

// Export for use in development/testing
export { SecurityTestSuite }; 