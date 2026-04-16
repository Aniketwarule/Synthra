import { Request, Response } from 'express';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import {
  createApiKey,
  createUsageLog,
  findActiveApiKeyByKey,
  findApiKeyByKey,
  incrementApiKeyUsage,
  listRecentUsageLogs,
} from '../repositories/apikeys';

// ─────────────────────────────────────────────────────────────
// Google GenAI Model Mapping
// Maps our internal model IDs → Google's model names
// ─────────────────────────────────────────────────────────────

const MODEL_MAP: Record<string, string> = {
  // Current frontend base model IDs
  'gemini-3-flash': 'gemini-3-flash-preview',

  // Legacy aliases kept for backward compatibility
  'gemini-1.5-pro': 'gemini-3-flash-preview',
  'gemini-1.5-pro-latest': 'gemini-3-flash-preview',
  'gpt-4o': 'gemini-3-flash-preview',
  'claude-3-opus': 'gemini-3-flash-preview',
  'deepseek-v2-lite': 'gemini-3-flash-preview',
};

// Pricing in ALGO per 1000 tokens
const TOKEN_PRICE_MAP: Record<string, number> = {
  'gemini-3-flash': 0.1,
  'gemini-1.5-pro': 0.01,
  'gemini-1.5-pro-latest': 0.01,
  'gpt-4o': 0.05,
  'claude-3-opus': 0.08,
  'deepseek-v2-lite': 0.01,
};

const maskApiKey = (apiKey: string): string => `${apiKey.substring(0, 16)}***`;

// ─────────────────────────────────────────────────────────────
// Lazy-init the Google GenAI client
// ─────────────────────────────────────────────────────────────

let _aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!_aiClient) {
    const token = process.env.GEMINI_API_KEY;
    if (!token) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    _aiClient = new GoogleGenAI({ apiKey: token });
  }
  return _aiClient;
}

// ─────────────────────────────────────────────────────────────
// POST /api/apikeys/generate
// Body: { walletAddress: string, modelId: string }
// Generates a new API key scoped to a model for a wallet.
// ─────────────────────────────────────────────────────────────
export const generateApiKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { walletAddress, modelId } = req.body;

    if (!walletAddress || !modelId) {
      res.status(400).json({ error: 'Missing walletAddress or modelId' });
      return;
    }

    const upstreamModel = MODEL_MAP[modelId];
    if (!upstreamModel) {
      res.status(400).json({ error: `Model "${modelId}" is not supported for API key generation` });
      return;
    }

    const randomBytes = crypto.randomBytes(24).toString('hex');
    const prefix = modelId.substring(0, 4).replace(/[^a-zA-Z0-9]/g, '');
    const apiKey = `ign_${prefix}_${randomBytes}`;

    const record = await createApiKey({
      key: apiKey,
      modelId,
      upstreamModel,
      walletAddress,
      hits: 0,
      totalTokens: 0,
      accruedAlgo: 0,
      isActive: true,
    });

    console.log(`[ApiKey] Generated key for wallet=${walletAddress} model=${modelId} → engine=${upstreamModel}`);

    res.status(201).json({
      apiKey: record.key,
      modelId: record.modelId,
      walletAddress: record.walletAddress,
      hits: record.hits,
      accruedAlgo: record.accruedAlgo,
      createdAt: record.createdAt,
    });
  } catch (error) {
    console.error('[ApiKey] Generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/apikeys/chat
// Header: Authorization: Bearer <apiKey>
// Body: { messages: [{role, content}], model?: string }
// Proxies to Google GenAI and returns the response.
// Traces every call in Supabase.
// ─────────────────────────────────────────────────────────────
export const chatCompletion = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    // ── Auth ──
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const apiKey = authHeader.split(' ')[1];
    const record = await findActiveApiKeyByKey(apiKey);

    if (!record) {
      res.status(403).json({ error: 'Invalid or revoked API key' });
      return;
    }

    // ── Parse request body ──
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Missing or invalid "messages" array in request body' });
      return;
    }

    // Use the model tied to the key (live mapping priority)
    const upstreamModel = MODEL_MAP[record.modelId] || record.upstreamModel;
    const promptSnippet = messages[messages.length - 1]?.content?.substring(0, 200) || '';

    // Convert OpenAI-style messages to Google GenAI contents
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    console.log(`[Chat] key=${apiKey.substring(0, 16)}... model_id=${record.modelId} engine_model=${upstreamModel}`);

    // ── Call Google GenAI ──
    const ai = getAIClient();
    const result = await ai.models.generateContent({
      model: upstreamModel,
      contents,
    });

    const latencyMs = Date.now() - startTime;
    const responseContent = result.text || '';
    const usage = result.usageMetadata;

    // ── Billing Calculation ──
    const totalTokens = usage?.totalTokenCount || 0;
    const tokenPrice = TOKEN_PRICE_MAP[record.modelId] || 0.01;
    const cost = (totalTokens / 1000) * tokenPrice;

    // ── Update counters ──
    await incrementApiKeyUsage(apiKey, totalTokens, cost);

    // ── Trace usage to Supabase ──
    await createUsageLog({
      apiKey: maskApiKey(apiKey),
      modelId: record.modelId,
      upstreamModel,
      walletAddress: record.walletAddress,
      promptTokens: usage?.promptTokenCount || 0,
      completionTokens: usage?.candidatesTokenCount || 0,
      totalTokens: totalTokens,
      promptSnippet: promptSnippet.substring(0, 200),
      responseSnippet: responseContent.substring(0, 200),
      latencyMs,
      status: 'success',
    });

    res.json({
      id: `genai-${crypto.randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: record.modelId,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: responseContent },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: usage?.promptTokenCount || 0,
        completion_tokens: usage?.candidatesTokenCount || 0,
        total_tokens: totalTokens
      }
    });

  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error('[Chat] Error:', error?.message || error);

    // Try to log the failure
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const apiKey = authHeader.split(' ')[1];
        const record = await findApiKeyByKey(apiKey);
        if (record) {
          await createUsageLog({
            apiKey: maskApiKey(apiKey),
            modelId: record.modelId,
            upstreamModel: record.upstreamModel,
            walletAddress: record.walletAddress,
            promptSnippet: '',
            responseSnippet: '',
            latencyMs,
            status: 'error',
            errorMessage: error?.message?.substring(0, 500),
          });
        }
      }
    } catch (_) { }

    if (error?.status === 429) {
      res.status(429).json({ error: 'Rate limited by upstream model provider. Try again shortly.' });
      return;
    }
    res.status(500).json({ error: 'Failed to get model response', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/apikeys/hit  (Legacy / simple prompt endpoint)
// Header: Authorization: Bearer <apiKey>
// Body: { prompt: string }
// ─────────────────────────────────────────────────────────────
export const hitApiKey = async (req: Request, res: Response): Promise<void> => {
  const { prompt } = req.body;
  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt' });
    return;
  }
  req.body.messages = [{ role: 'user', content: prompt }];
  await chatCompletion(req, res);
};

// ─────────────────────────────────────────────────────────────
// GET /api/apikeys/stats
// Query: ?key=<apiKey>
// ─────────────────────────────────────────────────────────────
export const getApiKeyStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = req.query.key as string;
    if (!apiKey) {
      res.status(400).json({ error: 'Missing key' });
      return;
    }

    const record = await findApiKeyByKey(apiKey);
    if (!record) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }

    const recentLogs = await listRecentUsageLogs(maskApiKey(apiKey), 10);

    res.status(200).json({
      apiKey: record.key,
      modelId: record.modelId,
      walletAddress: record.walletAddress,
      hits: record.hits,
      totalTokens: record.totalTokens,
      accruedAlgo: record.accruedAlgo,
      isActive: record.isActive,
      createdAt: record.createdAt,
      recentUsage: recentLogs,
    });
  } catch (error) {
    console.error('[ApiKey] Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
