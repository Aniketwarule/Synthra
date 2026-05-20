# 🚀 Synthra - Pay-As-You-Go AI API Platform
### ⚡ Enabling Autonomous AI Commerce with Sub-Cent Micropayments on Algorand

<div align="center">

[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](/)
[![Algorand](https://img.shields.io/badge/Algorand-000000?style=flat-square&logo=algorand&logoColor=white)](/)
[![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)](/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](/)

</div>

---

## 🌍 Vision

We are building the **financial backbone for the AI-native internet** — where AI agents can independently discover, consume, and pay for services without human intervention.

> 👉 Imagine a world where:
> - AI bots hire other AI bots
> - Payments happen instantly in the background
> - No subscriptions, no credit cards, no friction

**This project makes that vision real.**

---

## 🧠 Problem Deep Dive

### 🔴 1. The Subscription Trap
- AI services today rely on monthly subscriptions ($20+)
- Require KYC, credit cards, human ownership
- ❌ AI agents cannot participate in this system

### 🔴 2. Broken UX for Automation
- Web3 requires manual transaction approvals
- Every API call = popup confirmation 😵
- ❌ Impossible for autonomous AI workflows

### 🔴 3. Micropayment Impossibility
- Traditional rails (Stripe/Visa): `$0.30 + 3%` fee per transaction
- ❌ Cannot economically process `$0.001–$0.01` AI calls

---

## 💡 Our Solution

### ⚙️ x402 Protocol — Core Innovation
- Machine-readable pay-per-use AI access layer
- Built for recurring AI consumption, not one-time purchases

### 🔐 Algorand LogicSig — Game Changer
- **"Sign Once → Pay Infinite Times"**
- Removes need for repeated approvals
- Enables true autonomous payments

### ⚡ Atomic Micropayments
- Instant settlement
- Trustless revenue sharing
- Works at sub-cent scale

---

## 🏗️ System Architecture

### 🔄 Marketplace + Agent Flow

```
1. Creator publishes an agent or API endpoint with price + metadata
2. Catalog lists items for discovery (agents + APIs)
3. Consumer selects and sends a request
4. Payment handled via L402 (USDC) or delegated LogicSig session
5. Backend verifies payment and routes to internal LLM or external endpoint
6. Usage metrics and revenue are recorded
```

### 🧩 Components

| Layer | Technology |
|---|---|
| 🎨 Frontend | React (Vite) |
| ⚙️ Backend | Node.js + Express |
| 🤖 AI Layer | Groq + Gemini APIs |
| ⛓️ Blockchain | Algorand (LogicSig + Smart Contracts) |
| 🔗 Protocol | x402 (L402) |
| 🛒 Marketplace | x402 facilitator + Supabase catalog/metrics |
| 📦 SDK | synthra-x402 |

### 💳 Payment Modes

- **Delegated LogicSig session**: `/api/authorize/prepare` compiles a per-session LogicSig; `/api/authorize` stores the funded escrow. Requests use `Authorization: Delegated <address>` to auto-charge USDC without popups.
- **Standard L402 (USDC)**: client pays exact USDC, then sends `Authorization: Bearer <txId>` to `/api/generate` or `/api/base-models/generate`. The backend verifies confirmation and blocks reuse.

---

## 🌟 Key Differentiators

### ✅ Zero-Click UX
No popups. No approvals. Fully seamless AI execution.

### 🔗 Machine-Native Payments
AI agents interact with paywalls programmatically — no human in the loop.

### 💰 Sub-Cent Economy
Unlocks:
- Pay-per-prompt AI
- Micro SaaS APIs
- AI-to-AI commerce

### 🧩 Model Wrapping
Convert existing AI APIs into monetizable services instantly.

---

## 🛒 API Marketplace

### 👥 Participants

| Role | Description |
|---|---|
| 🧠 API Creators | Publish endpoints with price + metadata |
| 🤖 AI Agents | Discover and consume APIs autonomously |
| 👤 Users | Fund sessions or pay per call |

### 🔁 Marketplace Flow

```
Creator → /api/marketplace/deploy → Catalog
Agent/Dev → /api/marketplace/catalog → Pay (L402) → Call endpoint
Creator → /api/marketplace/metrics/:wallet → Revenue + usage analytics
```

### ✅ Marketplace APIs (Backend)

- **Publish endpoint**: `POST /api/marketplace/deploy` (name, description, target_url, price_usdc, tags)
- **Catalog**: `GET /api/marketplace/catalog`
- **Metrics**: `GET /api/marketplace/metrics/:wallet`
- **Facilitator**: `/api/marketplace/supported`, `/api/marketplace/verify`, `/api/marketplace/settle`
- **Discovery**: Bazaar metadata is extracted during settlement to help catalog endpoints

## 🤖 Agent Flow

### 🧩 Agent Types

- **Internal agents**: Hosted LLM calls (Groq) with a system prompt.
- **External agents**: Proxy to a creator-owned HTTP endpoint.

### 🔁 Agent Lifecycle

```
Creator → POST /api/publish → Agent listed
User/Agent → GET /api/agents → Select agent
User/Agent → POST /api/generate { prompt, agentId }
Payment → L402 txId or Delegated LogicSig → Verified → Routed → Response streamed
```

### 🧾 Agent Request Routing

- **Internal**: Calls Groq with the agent's base model + system prompt.
- **External**: Proxies to `endpointUrl` and forwards `X-Ignition-Agent` + `X-Ignition-TxId` headers.

---

## 🎯 Hackathon Impact

This project directly solves:

| Problem | Solution |
|---|---|
| 🚫 Subscription dependency | ✅ Pay-per-prompt micropayments |
| 🚫 Human-in-the-loop friction | ✅ LogicSig autonomous signing |
| 🚫 Broken micropayment economics | ✅ Sub-cent Algorand transactions |

**Enables:**
- AI-native SaaS economy
- Autonomous agent ecosystems
- Real-time monetization infrastructure

---

## 🎥 Demo Highlights

- 🔄 Autonomous AI prompt execution
- 💳 Wallet-based session funding
- ⚡ Real-time streaming output
- 🤖 No human interaction required

---

## 🛣️ Future Roadmap

```
NOW ──────────────────────────────────────────────────────────► FUTURE

 Phase 1          Phase 2            Phase 3             Phase 4
 Agent            Stablecoin         Multi-Agent         Reputation
 Discovery        Integration        Workflows           Layer
─────────         ──────────         ───────────         ─────────
• MCP endpoints   • ARC-52 std       • Researcher →      • On-chain
• AI service      • USDC / USDT        Synthesizer →       trust scores
  registry          payments           Translator        • Success-to-
                                       pipelines           payment ratio

  ✅ MVP           🔜 Q3 2026         🔜 Q4 2026          🔜 Q1 2027
```

---

## 🧠 Innovation Summary

| Feature | Impact |
|---|---|
| LogicSig Payments | Eliminates UX friction entirely |
| x402 Protocol | Enables AI-native commerce |
| Micropayments | Unlocks new business models |
| Autonomous Agents | Zero human dependency |

---

## 📜 License

MIT License — open source, free to use and extend post-hackathon.

---


<div align="center">

*"The future of AI isn't subscriptions — it's per-thought micropayments."*

**Built with ⚡ on Algorand · April 2026**

</div>
