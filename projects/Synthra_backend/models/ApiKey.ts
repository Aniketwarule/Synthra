export interface IApiKey {
  key: string;
  modelId: string;
  upstreamModel: string;
  walletAddress: string;
  hits: number;
  totalTokens: number;
  accruedAlgo: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
