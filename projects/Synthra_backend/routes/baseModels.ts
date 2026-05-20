import { Router, Response } from 'express';
import { L402VerifiedRequest, verifyIgnitionL402Payment } from '../middleware/verifyIgnitionL402Payment';
import crypto from 'crypto';

type BaseModelsGenerateBody = {
  prompt?: string;
  model?: string;
};

const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const resolveGroqModel = (requestedModel: string): string => {
  const aliases: Record<string, string> = {
    'gemini-2.0-flash': DEFAULT_GROQ_MODEL,
    'gpt-4o': DEFAULT_GROQ_MODEL,
    'claude-3-opus': DEFAULT_GROQ_MODEL,
  };

  return aliases[requestedModel] || requestedModel;
};

export const generateWithGroq = async (
  apiKey: string,
  modelName: string,
  prompt: string,
  requestId: string,
  attempt: number,
  systemPrompt?: string,
): Promise<string> => {
  console.info(`[BaseModels][${requestId}] AI attempt ${attempt} using provider=groq model=${modelName}`);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages: systemPrompt 
        ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }]
        : [{ role: 'user', content: prompt }],
      temperature: 0.7,
      stream: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Groq request failed with HTTP ${response.status}`) as Error & {
      status?: number;
      responseBody?: string;
    };
    error.status = response.status;
    error.responseBody = body;
    throw error;
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content || '';
};

const getProviderErrorMessage = (error: unknown): string => {
  const responseBody = (error as { responseBody?: string })?.responseBody;
  if (responseBody) {
    try {
      const parsed = JSON.parse(responseBody) as { error?: { message?: string } };
      return parsed.error?.message || responseBody;
    } catch {
      return responseBody;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'AI provider request failed';
};

const router = Router();

router.post('/generate', verifyIgnitionL402Payment, async (req: L402VerifiedRequest, res: Response): Promise<void> => {
  const { prompt, model } = req.body as BaseModelsGenerateBody;
  let consumePaymentProof = false;
  const requestId = crypto.randomUUID();
  let aiCallAttempts = 0;

  if (!prompt || !model) {
    req.finalizeIgnitionPayment?.(false);
    res.status(400).json({ error: 'Body must include prompt and model' });
    return;
  }

  const groqApiKey = (process.env.GROQ_API_KEY || '').trim();

  if (!groqApiKey) {
    req.finalizeIgnitionPayment?.(false);
    res.status(500).json({ error: 'No AI provider key configured. Set GROQ_API_KEY.' });
    return;
  }

  try {
    const preferredProvider = 'groq';

    // Stream plain text chunks so frontend receives token-by-token output.
    res.status(200);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Ignition-Payment-TxId', req.ignitionPayment?.txId || '');
    res.setHeader('X-Ignition-Request-Id', requestId);

    if (preferredProvider === 'groq') {
      const groqModel = resolveGroqModel(model);
      res.setHeader('X-Ignition-Provider', 'groq');
      res.setHeader('X-Ignition-Model', groqModel);

      let output = '';
      let lastGroqError: unknown = null;
      for (let retry = 1; retry <= 3; retry += 1) {
        aiCallAttempts += 1;
        try {
          output = await generateWithGroq(groqApiKey, groqModel, prompt, requestId, aiCallAttempts);
          lastGroqError = null;
          break;
        } catch (error) {
          lastGroqError = error;
          const status = (error as { status?: number })?.status;
          const shouldRetry = status === undefined || status >= 500 || status === 429;
          if (!shouldRetry || retry === 3) {
            throw error;
          }
          await sleep(600 * retry);
        }
      }

      if (lastGroqError) {
        throw lastGroqError;
      }

      res.write(output);
    }

    consumePaymentProof = true;
    res.end();
  } catch (error) {
    console.error(`[BaseModels][${requestId}] AI request failed after ${aiCallAttempts} attempt(s):`, error);

    const status = (error as { status?: number })?.status;
    const reason = getProviderErrorMessage(error);

    if (!res.headersSent) {
      if (status === 429) {
        res.status(429).json({ error: `AI provider quota exceeded. ${reason}` });
      } else if (status && status >= 500) {
        res.status(503).json({ error: `AI provider temporary failure. ${reason}` });
      } else {
        res.status(502).json({ error: `AI provider request failed. ${reason}` });
      }
      return;
    }

    // If headers already streamed, close the stream cleanly.
    res.end();
  } finally {
    req.finalizeIgnitionPayment?.(consumePaymentProof);
  }
});

export default router;
