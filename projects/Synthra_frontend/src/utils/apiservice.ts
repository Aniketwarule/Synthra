import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8080/api",
  headers: {
    "Content-Type": "application/json",
  },
});

type GeneratePayload = {
  prompt: string;
  agentId: string;
};

class ApiService {
  private async handleResponse(res: Response) {
    if (!res.ok) {
      if (res.status === 402) {
        const data = await res.json();
        throw { type: "PAYMENT_REQUIRED", data };
      }
      const error = await res.json();
      throw error;
    }
    return res;
  }

  async publishAgent(payload: any) {
    const res = await api.post(`/publish`, payload);

    // await this.handleResponse(res.data);
    return res.data;
  }

  async getAgents() {
    const res = await api.get(`/agents`);
    // await this.handleResponse(res.data);
    return res.data;
  }

  async generate(payload: GeneratePayload) {
    try {
      const res = await api.post(`/generate`);

      await this.handleResponse(res.data);
      return res.data;

    } catch (err: any) {
      if (err.type === "PAYMENT_REQUIRED") {
        console.log("💸 Payment required", err.data);

        const fakeTxId = "tx_" + Math.random().toString(36).substring(2);

        const retryRes = await api.post(`/generate`);

        if (!retryRes.data) {
          throw await retryRes.data;
        }

        return retryRes.data;
      }

      throw err;
    }
  }
}

export default new ApiService();