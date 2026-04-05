import HtmlGenerator from './src/generator/index.js';
import fs from 'fs';

console.log('Testing HTML Generator...\n');

try {
  const generator = new HtmlGenerator();
  
  const testData = {
    timestamp: new Date().toISOString(),
    sources: {
      web: [
        {
          name: 'Test Web Source',
          type: 'web',
          items: [
            {
              title: 'Test Article 1',
              titleZh: '测试文章 1',
              link: 'https://example.com/article1',
              summary: 'This is a test summary for article 1',
              summaryZh: '这是文章1的测试摘要'
            }
          ]
        }
      ],
      rss: [
        {
          name: 'Test RSS Source',
          type: 'rss',
          items: [
            {
              title: 'Test RSS Article',
              titleZh: '测试RSS文章',
              link: 'https://example.com/rss1',
              summary: 'RSS test summary',
              summaryZh: 'RSS测试摘要'
            }
          ]
        }
      ],
      github: [
        {
          name: 'Test GitHub Source',
          type: 'github',
          items: [
            {
              name: 'test-repo',
              link: 'https://github.com/test/test-repo',
              summary: 'A test GitHub repository',
              summaryZh: '一个测试GitHub仓库',
              description: 'Test description'
            }
          ]
        }
      ]
    }
  };
  
  const html = generator.generate(testData);
  
  console.log('✅ HTML generated successfully!');
  console.log('\nHTML preview (first 500 chars):');
  console.log(html.substring(0, 500) + '...');
  
  fs.writeFileSync('.sisyphus/evidence/final-qa/test-generated.html', html);
  fs.writeFileSync('.sisyphus/evidence/final-qa/html-generator-success.txt', 
    'HTML generator test passed!\n\nGenerated HTML saved to test-generated.html');
  
  console.log('\n✅ HTML saved to .sisyphus/evidence/final-qa/test-generated.html');
  
} catch (error) {
  console.error('❌ HTML generator test failed:');
  console.error(error.message);
  console.error(error.stack);
  
  fs.writeFileSync('.sisyphus/evidence/final-qa/html-generator-error.txt', 
    'HTML generator test failed:\n' + error.message + '\n' + error.stack);
}
