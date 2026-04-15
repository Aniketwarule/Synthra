export type UsageStatus = 'success' | 'error';

export interface IUsageLog {
  apiKey: string;
  modelId: string;
  upstreamModel: string;
  walletAddress: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptSnippet: string;
  responseSnippet: string;
  latencyMs: number;
  status: UsageStatus;
  errorMessage?: string;
  createdAt: string;
}
