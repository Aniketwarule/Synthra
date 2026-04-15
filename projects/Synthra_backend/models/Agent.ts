export type HostingType = 'internal' | 'external';

export interface IAgent {
  id?: string;
  _id?: string;
  agentId: string;
  name: string;
  description: string;
  priceAlgo: number;
  creatorWallet: string;
  hostingType: HostingType;
  baseModel?: string;
  systemPrompt?: string;
  endpointUrl?: string;
  APIkey?: string;
  createdAt?: string;
  updatedAt?: string;
}
