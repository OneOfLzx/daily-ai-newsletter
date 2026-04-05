import { loadConfig } from './src/config/index.js';
import fs from 'fs';

console.log('Testing edge cases...\n');

const evidence = [];

try {
  console.log('Test 1: Empty config file');
  try {
    fs.writeFileSync('empty-config.yaml', '');
    loadConfig('./empty-config.yaml');
    evidence.push('Test 1 FAIL: Expected error for empty config');
    console.log('❌ Test 1 FAIL: Expected error but none thrown');
  } catch (error) {
    evidence.push('Test 1 PASS: Correctly handled empty config');
    console.log('✅ Test 1 PASS:', error.message);
  }
  
  console.log('\nTest 2: Config missing llm section');
  try {
    fs.writeFileSync('missing-llm.yaml', 'sources:\n  web: []');
    loadConfig('./missing-llm.yaml');
    evidence.push('Test 2 FAIL: Expected error for missing llm');
    console.log('❌ Test 2 FAIL: Expected error but none thrown');
  } catch (error) {
    evidence.push('Test 2 PASS: Correctly handled missing llm');
    console.log('✅ Test 2 PASS:', error.message);
  }
  
  console.log('\nTest 3: Config missing api_key');
  try {
    fs.writeFileSync('missing-api-key.yaml', 'llm:\n  model: gpt-3.5\nsources:\n  web: []');
    loadConfig('./missing-api-key.yaml');
    evidence.push('Test 3 FAIL: Expected error for missing api_key');
    console.log('❌ Test 3 FAIL: Expected error but none thrown');
  } catch (error) {
    evidence.push('Test 3 PASS: Correctly handled missing api_key');
    console.log('✅ Test 3 PASS:', error.message);
  }
  
  console.log('\nTest 4: Email source (forbidden)');
  try {
    fs.writeFileSync(
      'email-source.yaml',
      'llm:\n  api_key: test\n' +
        'skills:\n  web: summarization\n  rss: summarization\n  github: summarization\n  translation: translation\n' +
        'sources:\n  email: []'
    );
    loadConfig('./email-source.yaml');
    evidence.push('Test 4 FAIL: Expected error for email source');
    console.log('❌ Test 4 FAIL: Expected error but none thrown');
  } catch (error) {
    evidence.push('Test 4 PASS: Correctly rejected email source');
    console.log('✅ Test 4 PASS:', error.message);
  }
  
  fs.writeFileSync('.sisyphus/evidence/final-qa/edge-cases-results.txt', 
    'Edge Case Tests:\n\n' + evidence.join('\n'));
  
  fs.unlinkSync('empty-config.yaml');
  fs.unlinkSync('missing-llm.yaml');
  fs.unlinkSync('missing-api-key.yaml');
  fs.unlinkSync('email-source.yaml');
  
  console.log('\n✅ Edge case tests completed!');
  
} catch (error) {
  console.error('❌ Edge case test failed:', error);
  fs.writeFileSync('.sisyphus/evidence/final-qa/edge-cases-error.txt', 
    'Edge case test failed:\n' + error.message + '\n' + error.stack);
}
