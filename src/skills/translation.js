import { USER_PROMPTS } from './prompts.js';

/**
 * @param {string} text
 * @param {object} options
 * @param {import('../llm/openai.js').OpenAIClient} [options.openai]
 * @param {string} [options.systemPrompt]
 */
async function translate(text, options = {}) {
  const { openai, systemPrompt } = options;

  if (openai) {
    if (!systemPrompt || typeof systemPrompt !== 'string') {
      throw new Error('systemPrompt is required when using OpenAI client');
    }
    if (!text || text.trim() === '') {
      return '';
    }
    const userContent = `${USER_PROMPTS.translateToZh}${text}`;
    const response = await openai.chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.3
    });
    return response.content.trim();
  }

  if (!text || text.trim() === '') {
    return '';
  }

  const mockTranslations = {
    'Hello, world!': '你好，世界！',
    'GitHub is a popular platform for code hosting.': 'GitHub 是一个流行的代码托管平台。',
    'API stands for Application Programming Interface.': 'API 代表应用程序编程接口。',
    'AI is transforming many industries.': 'AI 正在改变许多行业。'
  };

  return mockTranslations[text] || `[翻译] ${text}`;
}

/**
 * @param {string[]} texts
 * @param {object} options
 */
async function translateBatch(texts, options = {}) {
  if (!Array.isArray(texts)) {
    throw new Error('translateBatch expects an array of texts');
  }

  return Promise.all(texts.map(text => translate(text, options)));
}

export { translate, translateBatch };
