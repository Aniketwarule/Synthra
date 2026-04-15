import { Router } from 'express';
import { createAgent, getAgents } from '../controllers/agent.controller';
import { generateRoute } from '../controllers/generate';

const router = Router();

router.post('/publish', createAgent);
router.get('/agents', getAgents);
router.post('/generate', generateRoute);

export default router;