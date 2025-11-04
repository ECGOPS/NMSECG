#!/usr/bin/env node

/**
 * Validation Edge Case Test Runner
 * 
 * This script runs comprehensive edge case testing for the NMS validation system
 * to ensure all input validation scenarios are properly handled.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 Running Validation Edge Case Tests...\n');

// Check if we're in the right directory
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ Error: package.json not found. Please run this script from the project root.');
  process.exit(1);
}

// Check if test file exists
const testFilePath = path.join(process.cwd(), 'src', 'tests', 'validation-edge-cases.test.ts');
if (!fs.existsSync(testFilePath)) {
  console.error('❌ Error: Test file not found at:', testFilePath);
  process.exit(1);
}

try {
  console.log('📋 Test Coverage Areas:');
  console.log('├── Empty and Null Values');
  console.log('├── Extremely Long Inputs');
  console.log('├── Special Characters and Encoding');
  console.log('├── Boundary Values');
  console.log('├── Conditional Validation');
  console.log('├── Date Validation');
  console.log('├── Array Validation');
  console.log('├── Role-Based Validation');
  console.log('├── Password Complexity');
  console.log('├── Email Validation');
  console.log('├── XSS Payload Handling');
  console.log('├── SQL Injection Handling');
  console.log('├── Performance Testing');
  console.log('└── Memory Usage Testing\n');

  console.log('🚀 Starting tests...\n');

  // Run the tests using npm test or vitest
  const testCommand = 'npm test -- --run src/tests/validation-edge-cases.test.ts';
  
  console.log(`Executing: ${testCommand}\n`);
  
  const result = execSync(testCommand, { 
    stdio: 'inherit',
    cwd: process.cwd()
  });

  console.log('\n✅ All validation edge case tests completed successfully!');
  console.log('\n📊 Test Summary:');
  console.log('├── Schema validation edge cases: ✓ Tested');
  console.log('├── Input sanitization edge cases: ✓ Tested');
  console.log('├── Business logic validation: ✓ Tested');
  console.log('├── Performance edge cases: ✓ Tested');
  console.log('├── Security edge cases: ✓ Tested');
  console.log('└── Memory usage edge cases: ✓ Tested');

} catch (error) {
  console.error('\n❌ Test execution failed:');
  console.error(error.message);
  
  console.log('\n🔧 Troubleshooting Tips:');
  console.log('1. Ensure all dependencies are installed: npm install');
  console.log('2. Check if vitest is configured properly');
  console.log('3. Verify the test file path is correct');
  console.log('4. Check for TypeScript compilation errors');
  
  process.exit(1);
}

console.log('\n🎯 Next Steps:');
console.log('1. Review any failed tests and fix validation logic');
console.log('2. Add additional edge cases based on real-world usage');
console.log('3. Run tests in CI/CD pipeline for continuous validation');
console.log('4. Monitor test performance and optimize if needed');
console.log('5. Document any new edge cases discovered');

console.log('\n🏁 Validation edge case testing complete! 🧪');
