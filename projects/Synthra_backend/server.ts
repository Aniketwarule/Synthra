import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateApiKey, hitApiKey, chatCompletion, getApiKeyStats } from './routes/apikeys';
import agentRoutes from './routes/agent.routes';
import dns from 'node:dns';
import { generateRoute } from './controllers/generate';
import baseModelsRouter from './routes/baseModels';
import { SupabaseSchemaNotReadyError, verifySupabaseConnection } from './db/supabase';

dotenv.config();
dns.setDefaultResultOrder('ipv4first');

const app = express();
const PORT = process.env.PORT || 8080;
let isDegradedMode = false;

app.use(cors());
app.use(express.json());

const healthHandler: express.RequestHandler = (_req, res) => {
  res.status(200).json({
    ok: true,
    status: isDegradedMode ? 'degraded' : 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};

// Health-check endpoints for Render/UptimeRobot keep-alive and monitoring.
app.get('/healthz', healthHandler);
app.get('/api/healthz', healthHandler);

// Main Proxy endpoint
app.post('/api/generate', generateRoute);

// Base model L402 endpoint
app.use('/api/base-models', baseModelsRouter);

// API Key management
app.post('/api/apikeys/generate', generateApiKey);
app.post('/api/apikeys/chat', chatCompletion);   // OpenAI-compatible chat endpoint
app.post('/api/apikeys/hit', hitApiKey);          // Legacy simple prompt endpoint
app.get('/api/apikeys/stats', getApiKeyStats);
app.use('/api', agentRoutes);

const startServer = async () => {
  try {
    let degradedMode = false;

    try {
      await verifySupabaseConnection();
      console.log('[Init] Connected to Supabase');
    } catch (error) {
      if (error instanceof SupabaseSchemaNotReadyError) {
        degradedMode = true;
        isDegradedMode = true;
        console.warn(error.message);
        console.warn('[Init] Starting in degraded mode: DB-backed routes will fail until migration is applied.');
      } else {
        throw error;
      }
    }

    app.listen(PORT, () => {
      console.log(`Server started on http://localhost:${PORT}${degradedMode ? ' [degraded-mode]' : ''}`);
    });
  } catch (error) {
    console.error('[Init] Server startup failed:', error);
    process.exit(1);
  }
};

startServer();
