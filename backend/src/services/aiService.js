const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

/**
 * Send a file to the AI tamper-detection microservice for analysis.
 * POST http://localhost:6000/analyze  (multipart file)
 *
 * @param {string} filePath Absolute path to the file on disk
 * @param {string} originalName Original filename
 * @returns {Promise<{ aiRiskFlag: string, details: object }>}
 */
async function analyzeDocument(filePath, originalName) {
  const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:6000';

  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), originalName);

    const response = await fetch(`${aiUrl}/analyze`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      // 30-second timeout for AI processing
      timeout: 30000,
    });

    if (!response.ok) {
      throw new Error(`AI service returned ${response.status}`);
    }

    const data = await response.json();
    return {
      aiRiskFlag: data.aiRiskFlag || 'review_recommended',
      details: data.details || {},
    };
  } catch (err) {
    console.warn('[AI] Analysis failed (service may be offline):', err.message);
    // Graceful fallback — flag for manual review
    return {
      aiRiskFlag: 'review_recommended',
      details: { error: 'AI service unavailable', message: err.message },
    };
  }
}

module.exports = { analyzeDocument };
