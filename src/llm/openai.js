import OpenAI from 'openai';
import Logger from '../utils/logger.js';

const logger = new Logger('openai');

/**
 * OpenAI API Client
 * Supports GPT-4/GPT-3.5, retries, error handling, and token usage stats
 */
export class OpenAIClient {
  /**
   * Create an OpenAIClient instance
   * @param {Object} config - Configuration options
   * @param {string} config.apiKey - OpenAI API key
   * @param {string} [config.baseUrl] - Optional base URL for API endpoint
   * @param {string} [config.model='gpt-4'] - Default model to use
   * @param {number} [config.maxRetries=3] - Maximum number of retries
   * @param {number} [config.timeout=60000] - Request timeout in milliseconds
   */
  constructor(config) {
    this.config = {
      apiKey: config.api_key,
      baseURL: config.base_url,
      model: config.model || 'gpt-4',
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 60000,
    };

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
    });

    this.tokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    /** @type {(() => void) | null} */
    this._tokenUsageListener = null;

    logger.info('OpenAI client initialized');
  }

  /**
   * Optional hook invoked after each successful usage merge (e.g. CLI live status).
   * @param {(() => void) | null} fn
   */
  setTokenUsageListener(fn) {
    this._tokenUsageListener = typeof fn === 'function' ? fn : null;
  }

  /**
   * Get current token usage statistics
   * @returns {Object} Token usage stats
   */
  getTokenUsage() {
    logger.debug('Getting token usage');
    return { ...this.tokenUsage };
  }

  /**
   * Reset token usage statistics
   */
  resetTokenUsage() {
    logger.info('Resetting token usage');
    this.tokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
  }

  /**
   * Update token usage stats from API response
   * @param {Object} usage - Usage object from OpenAI response
   * @private
   */
  _updateTokenUsage(usage) {
    if (usage) {
      // Single-threaded JS: += is atomic per event turn; safe for concurrent in-flight requests.
      this.tokenUsage.promptTokens += usage.prompt_tokens || 0;
      this.tokenUsage.completionTokens += usage.completion_tokens || 0;
      this.tokenUsage.totalTokens +=
        usage.total_tokens ??
        (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
      logger.debug(`Token usage updated: ${JSON.stringify(this.tokenUsage)}`);
    }
    // Always notify: some providers omit `usage` on chat.completions (e.g. tool rounds). The
    // pipeline TUI still needs redraws after each successful call so worker lines stay visible.
    this._tokenUsageListener?.();
  }

  /**
   * Check if an error is retryable
   * @param {Error} error - Error to check
   * @returns {boolean} True if error is retryable
   * @private
   */
  _isRetryableError(error) {
    if (!error) return false;
    
    // Retry on network errors
    if (error.name === 'APIConnectionError' || 
        error.name === 'APIConnectionTimeoutError') {
      logger.warn(`Retryable error (network): ${error.name}`);
      return true;
    }

    // Retry on rate limits and server errors
    if (error.status) {
      if (error.status === 429 || (error.status >= 500 && error.status < 600)) {
        logger.warn(`Retryable error (HTTP): ${error.status}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Wait for exponential backoff
   * @param {number} attempt - Current attempt number (0-based)
   * @private
   */
  async _exponentialBackoff(attempt) {
    const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
    logger.debug(`Exponential backoff: waiting ${delay}ms for attempt ${attempt}`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Execute an API call with retries
   * @param {Function} fn - Function to execute
   * @returns {Promise<any>} Result of the function
   * @private
   */
  async _executeWithRetry(fn) {
    let lastError;
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (this._isRetryableError(error) && attempt < this.config.maxRetries - 1) {
          await this._exponentialBackoff(attempt);
          continue;
        }
        
        logger.error(`OpenAI API call failed: ${error.message}`);
        throw error;
      }
    }
    
    throw lastError;
  }

  /**
   * Create a chat completion (non-streaming)
   * @param {Object} params - Chat completion parameters
   * @param {Array} params.messages - Array of message objects
   * @param {string} [params.model] - Model to use (defaults to config.model)
   * @param {number} [params.temperature=0.7] - Sampling temperature
   * @param {number} [params.maxTokens] - Maximum tokens to generate
   * @param {Object} [params.options] - Additional OpenAI API options (e.g. tools, tool_choice)
   * @returns {Promise<{ content: string, role: string, usage: object, model: string, id: string, finish_reason?: string, tool_calls?: object[] }>}
   */
  async chatCompletion(params) {
    const {
      messages,
      model = this.config.model,
      temperature = 0.7,
      maxTokens = 1000,
      options = {},
    } = params;

    logger.debug(`Creating chat completion with model: ${model}`);

    const response = await this._executeWithRetry(async () => {
      return await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
        ...options,
      });
    });

    this._updateTokenUsage(response.usage);
    
    logger.debug('Chat completion successful');
    const choice = response.choices[0];
    const msg = choice?.message;
    return {
      content: msg?.content ?? '',
      role: msg?.role || 'assistant',
      usage: response.usage,
      model: response.model,
      id: response.id,
      finish_reason: choice?.finish_reason,
      tool_calls: msg?.tool_calls
    };
  }

  /**
   * Create a streaming chat completion
   * @param {Object} params - Chat completion parameters
   * @param {Array} params.messages - Array of message objects
   * @param {string} [params.model] - Model to use (defaults to config.model)
   * @param {number} [params.temperature=0.7] - Sampling temperature
   * @param {number} [params.maxTokens] - Maximum tokens to generate
   * @param {Object} [params.options] - Additional OpenAI API options
   * @param {Function} params.onChunk - Callback for each chunk (content: string)
   * @param {Function} [params.onComplete] - Callback when complete (response: Object)
   * @returns {Promise<Object>} Final completion response
   */
  async streamChatCompletion(params) {
    const {
      messages,
      model = this.config.model,
      temperature = 0.7,
      maxTokens,
      options = {},
      onChunk,
      onComplete,
    } = params;

    logger.debug(`Creating streaming chat completion with model: ${model}`);

    let fullContent = '';
    let finalResponse = null;

    const stream = await this._executeWithRetry(async () => {
      return await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        ...options,
      });
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullContent += content;
        if (onChunk) {
          onChunk(content);
        }
      }

      // Update usage if available in final chunk
      if (chunk.usage) {
        this._updateTokenUsage(chunk.usage);
        finalResponse = {
          content: fullContent,
          role: 'assistant',
          usage: chunk.usage,
          model: chunk.model,
          id: chunk.id,
        };
      }
    }

    if (!finalResponse) {
      finalResponse = {
        content: fullContent,
        role: 'assistant',
        usage: null,
        model,
        id: null,
      };
    }

    if (onComplete) {
      onComplete(finalResponse);
    }

    logger.debug('Streaming chat completion successful');
    return finalResponse;
  }

  /**
   * Create a simple text completion (convenience method)
   * @param {string} prompt - User prompt
   * @param {string} [systemPrompt] - Optional system prompt
   * @param {Object} [options] - Additional options
   * @returns {Promise<string>} Completion text
   */
  async complete(prompt, systemPrompt, options = {}) {
    logger.debug('Creating simple text completion');
    const messages = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const response = await this.chatCompletion({
      messages,
      ...options,
    });

    return response.content;
  }
}

export default OpenAIClient;
