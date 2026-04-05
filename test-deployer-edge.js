import deploy from './src/deploy/index.js';
import fs from 'fs';

console.log('Testing deployer edge cases...\n');

const evidence = [];

try {
  console.log('Test 1: Deploy without GITHUB_PAGES_REPO');
  try {
    await deploy();
    evidence.push('Test 1 FAIL: Expected error but none thrown');
    console.log('❌ Test 1 FAIL: Expected error but none thrown');
  } catch (error) {
    evidence.push('Test 1 PASS: Correctly threw error for missing repo');
    console.log('✅ Test 1 PASS: Correctly threw error -', error.message);
  }
  
  console.log('\nTest 2: Deploy with invalid repo URL');
  try {
    process.env.GITHUB_PAGES_REPO = 'invalid-url';
    await deploy();
    evidence.push('Test 2 FAIL: Expected error but none thrown');
    console.log('❌ Test 2 FAIL: Expected error but none thrown');
  } catch (error) {
    evidence.push('Test 2 PASS: Correctly handled invalid repo');
    console.log('✅ Test 2 PASS: Correctly handled invalid repo -', error.message);
  }
  
  fs.writeFileSync('.sisyphus/evidence/final-qa/deployer-edge-cases.txt', 
    'Deployer Edge Case Tests:\n\n' + evidence.join('\n'));
  
  console.log('\n✅ Deployer edge case tests completed!');
  
} catch (error) {
  console.error('❌ Deployer test failed:', error);
  fs.writeFileSync('.sisyphus/evidence/final-qa/deployer-test-error.txt', 
    'Deployer test failed:\n' + error.message + '\n' + error.stack);
}
