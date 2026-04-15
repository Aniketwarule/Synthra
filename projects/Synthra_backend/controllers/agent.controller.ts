import { Request, Response } from 'express';
import {
  createAgent as createAgentRecord,
  CreateAgentInput,
  listAgents,
} from '../repositories/agents';

export const createAgent = async (req: Request, res: Response) => {
  try {
    const payload = req.body as CreateAgentInput;
    const agent = await createAgentRecord(payload);

    res.status(201).json({
      message: "Agent created successfully",
      agent
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAgents = async (_req: Request, res: Response) => {
  try {
    const agents = await listAgents();

    res.status(200).json(agents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
