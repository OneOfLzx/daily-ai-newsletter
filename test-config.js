import { loadConfig } from './src/config/index.js';
import fs from 'fs';

console.log('Testing configuration loading...\n');

try {
  const config = loadConfig('./config.yaml');
  console.log('✅ Configuration loaded successfully!');
  console.log('\nConfig content:');
  console.log(JSON.stringify(config, null, 2));
  
  fs.writeFileSync('.sisyphus/evidence/final-qa/config-load-success.txt', 
    'Configuration loaded successfully!\n\n' + JSON.stringify(config, null, 2));
  
} catch (error) {
  console.error('❌ Configuration loading failed:');
  console.error(error.message);
  
  fs.writeFileSync('.sisyphus/evidence/final-qa/config-load-error.txt', 
    'Configuration loading failed:\n' + error.message);
}
