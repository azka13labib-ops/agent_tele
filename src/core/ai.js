const { OpenAI } = require('openai');
const { AI_BASE_URL, AI_API_KEY } = require('../config/env');

const openai = new OpenAI({
  baseURL: AI_BASE_URL,
  apiKey: AI_API_KEY
});

module.exports = {
  openai
};

