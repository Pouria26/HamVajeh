<div align="center">

# 📖 HamVajeh | هم‌واژه
### Intelligent Persian Collocation Exploration & AI Tutoring Platform

[![Live App](https://img.shields.io/badge/Live%20App-hamvajeh.vercel.app-0d9488?style=for-the-badge&logo=vercel)](https://hamvajeh.vercel.app)
[![API Gateway](https://img.shields.io/badge/API%20Gateway-Railway-0b6bcb?style=for-the-badge&logo=railway)](https://hamvajeh-backend-production.up.railway.app)
[![AI Agent Docs](https://img.shields.io/badge/AI%20Agent-FastAPI%20Docs-059669?style=for-the-badge&logo=fastapi)](https://hamvajeh-agent-production.up.railway.app/docs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

---

### 🌐 Language Switch / انتخاب زبان
👉 **[🇮🇷 مطالعه مستندات به زبان فارسی (Persian Documentation)](README-fa.md)** 👈

---

### 🎬 Application Video Demo (76s)

https://github.com/user-attachments/assets/b95ec5a2-c3b6-47ea-90a3-77556db77903

> 💡 **Live Production Application**: [hamvajeh.vercel.app](https://hamvajeh.vercel.app)

</div>

---

## 📌 Table of Contents
- [Project Overview & Linguistic Mission](#-project-overview--linguistic-mission)
- [Key Architectural Features](#-key-architectural-features)
  - [1. Trigram Collocation Search & Syntactic Categories](#1-trigram-collocation-search--syntactic-categories)
  - [2. Zero-Hit Search Assistant (Unindexed & Calque Diagnostic)](#2-zero-hit-search-assistant-unindexed--calque-diagnostic)
  - [3. Categorical Collocation Explorer (Browse)](#3-categorical-collocation-explorer-browse)
  - [4. Collocation Detail & 3-Register Sentence Workshop](#4-collocation-detail--3-register-sentence-workshop)
  - [5. Daily Challenge & Gamified Collocation Quizzes](#5-daily-challenge--gamified-collocation-quizzes)
  - [6. HamYar Autonomous AI Tutor Microservice](#6-hamyar-autonomous-ai-tutor-microservice)
  - [7. Secured Admin Panel & Moderation Workspace](#7-secured-admin-panel--moderation-workspace)
  - [8. Progressive Web App (PWA)](#8-progressive-web-app-pwa)
- [Corpus Extraction Methodology & Statistical Foundations](#-corpus-extraction-methodology--statistical-foundations)
- [System Architecture & Cloud Topology](#-system-architecture--cloud-topology)
- [Technology Stack Matrix](#-technology-stack-matrix)
- [Local Installation & Docker Guide](#-local-installation--docker-guide)
- [Contributing & Community](#-contributing--community)
- [Academic Citation & License](#-academic-citation--license)

---

## 🎯 Project Overview & Linguistic Mission

A **collocation** (باهم‌آیی) is a sequence or combination of words that co-occur with natural frequency and conventional idiomaticity in native speech (e.g., Persian *«تصمیم گرفتن»* [to make a decision] vs. the unnatural direct translation/calque *«تصمیم ساختن»*). Natural collocation mastery is a primary benchmark distinguishing fluent speakers and high-standard NLP generation from machine-translated artifacts.

**HamVajeh** («هم‌واژه») is a production-grade research and educational platform that bridges classical computational corpus linguistics and modern agentic artificial intelligence. Built upon **160,000+ authentic articles from the Hamshahri newspaper corpus**, HamVajeh provides:
1. An indexed repository of **4,184 verified Persian collocations** and **20,920 authentic corpus citations**.
2. An autonomous **AI Tutor Microservice («هم‌یار»)** powered by Pydantic AI and Google Gemini Flash models.
3. An interactive **Progressive Web App (PWA)** featuring deterministic daily challenges, categorical exploration, and register-specific sentence generation.
4. A **token-gated Admin Curation Console** for real-time dataset moderation, triage, and live database mutations.

<p align="center">
  <img src="assets/HamVajeh_Home_Page.jpg" alt="HamVajeh Home Page" width="95%" />
</p>

---

## ✨ Key Architectural Features

### 1. Trigram Collocation Search & Syntactic Categories
* **PostgreSQL GIN Trigram Search (`pg_trgm`)**: Lightning-fast prefix and substring searches resilient to spacing inconsistencies and verbal prefix conjugations.
* **4 Authentic Syntactic Categories**:
  1. **Noun Combinations**: e.g., «پدر و مادر» (parents), «حقوق بشر» (human rights).
  2. **Adjectival Combinations**: e.g., «نکته ایمنی» (safety tip), «هوای سرد» (cold weather), «تصمیم قاطع» (firm decision).
  3. **Compound Verbs (Verbal Collocations)**: e.g., «تصمیم گرفتن» (to make a decision), «دست کشیدن» (to abandon), «آتش زدن» (to set on fire).
  4. **Other Syntactic Patterns**: Prepositional phrases and compound connective bigrams.
* **Encapsulated Qualitative Frequency Tiers**: Raw statistical metrics ($PMI$, $t$-score) are shielded from non-academic users, cleanly mapped into qualitative badges:
  - **«پرتکرار» (Very Frequent)**: Score $\ge 60$
  - **«متداول» (Common)**: Score $\ge 40$
  - **«عادی» (Standard)**: Score $\ge 15$

<p align="center">
  <img src="assets/Search.jpg" alt="HamVajeh Live Search" width="90%" />
</p>

---

### 2. Zero-Hit Search Assistant (Unindexed & Calque Diagnostic)
When a user searches for a term not directly present in the database, the application prevents empty state frustration by invoking the **Intelligent Search Assistant**:
* Evaluates whether the searched phrase is an **authentic Persian collocation** that happens to be absent from the dataset.
* Identifies **unnatural combinations, foreign calques** (such as *«تصمیم ساختن»*), **spelling mistakes**, or **QWERTY layout errors** (`sghl` $\rightarrow$ «سلام»).
* Generates clear linguistic reasoning and suggests authentic alternative collocations along with a natural example sentence.

<p align="center">
  <img src="assets/Search_No_Answer.jpg" alt="Search Assistant Zero-Hit Card" width="90%" />
</p>

---

### 3. Categorical Collocation Explorer (Browse)
The Categorical Explorer allows users and researchers to learn Persian collocations structurally:
* Provides direct access to all **4 primary syntactic categories** and their associated collocations.
* Enables systematic step-by-step vocabulary expansion organized by natural syntactic patterns.

<p align="center">
  <img src="assets/Review.jpg" alt="Browse Collocations by Category" width="90%" />
</p>

---

### 4. Collocation Detail & 3-Register Sentence Workshop
Clicking any collocation opens its dedicated detail page:
* Contextualizes usage through authentic corpus sentences and highlights syntactic collocations.
* **Intelligent Sentence Workshop**: With a single click, the AI tutor generates 3 natural sentences across distinct communicative registers:
  1. *Formal & Administrative*: For corporate letters, contracts, and legal documentation.
  2. *Journalistic & Analytical*: For press reports, economic analyses, and academic papers.
  3. *Daily & Narrative*: For conversational storytelling and colloquial dialogue.
  Includes a concise linguistic explanation detailing why the collocation fits each register.

<p align="center">
  <img src="assets/Review_Word_&_Sentences.jpg" alt="Collocation Detail and 3-Register Sentence Workshop" width="90%" />
</p>

---

### 5. Daily Challenge & Gamified Collocation Quizzes
* **Deterministic Daily Challenge**: Generates the **exact same 5 multiple-choice questions** worldwide on any given UTC date using `setseed(dateToSeed("YYYY-MM-DD"))`.
* **Adaptive Practice Engine**: Random quiz generator drawing from 83,000+ distractor options.
* **AI Quiz Mistake Explainer**: When a user selects an incorrect option, the AI tutor compares the distractors, explaining the subtle semantic, register, or syntactic reasons why the chosen word violates native usage habits.

<p align="center">
  <img src="assets/Daily_Challenge.jpg" alt="Daily Challenge with AI Mistake Explainer" width="90%" />
</p>

---

### 6. HamYar Autonomous AI Tutor Microservice
Powered by **Pydantic AI**, **Google Gemini**, and **FastAPI**, «هم‌یار» functions as an empathetic, expert Persian linguist:
* **Comprehensive Linguistic Understanding**: Correctly treats compound verbs (e.g. «تصمیم گرفتن», «دست کشیدن», «سلام کردن») as core verbal collocations, bridging verbal, adjectival, and nominal pairings.
* **Polite & Natural Conversation**: Eliminates repetitive greeting formulas on intermediate conversation turns and dives straight into analytical answers.
* **3-Tier Model Fallback Chain**:
  1. *Primary*: `gemini-3.5-flash-lite` (Ultra-fast, high Persian fluency, 500 RPD)
  2. *Secondary*: `gemini-3.1-flash-lite` (High reliability fallback)
  3. *Tertiary*: `kimi-k3` via NVIDIA NIM (Robust tertiary backup for quota exhaustion)
* **Token Optimization Architecture**: Replaced multi-step agent tool loops with an all-in-one compound query tool (`search_collocations` returning matching lemma, category, frequency tier, and sample sentences), decreasing token consumption by **85–90%**.

<p align="center">
  <img src="assets/HamYar.jpg" alt="HamYar Interactive Chat Interface" width="90%" />
</p>

---

### 7. Secured Admin Panel & Moderation Workspace
A purpose-built curation environment enabling academic maintainers to oversee and refine the dataset:
* **Token-Protected Security (`ADMIN_TOKEN`)**: Guarded by constant-time timing-safe token evaluation via `Authorization: Bearer <ADMIN_TOKEN>`.
* **Dataset Management & Filters**: Filter collocations across `all`, `valid`, `corrected`, and `needs_review` statuses.
* **Live In-Place Mutations (CRUD)**: Update display forms, record human audit notes, modify frequency scores, or author brand-new collocations with examples and distractors in atomic SQL transactions.
* **Bulk Review Resolution (`POST /api/admin/collocations/clear-needs-review`)**: Batch-clear review flags with one click.
* **User Report Triage**: Review community-flagged errata with full sentence context and export full dataset to standard CSV.

<p align="center">
  <img src="assets/Admin_Page.jpg" alt="Admin Moderation Dashboard" width="90%" />
</p>

---

### 8. Progressive Web App (PWA)
* Seamless installation on iOS, Android, macOS, and Windows.
* Local storage persistence for recent history, streak counts, and multi-session chat histories.
* Instant service-worker updates with user notification banners.

---

## 🔬 Corpus Extraction Methodology & Statistical Foundations

The extraction pipeline processed **160,000+ XML documents** from the Hamshahri archive:

```mermaid
flowchart TD
    A[Hamshahri Articles .ham] --> B[Text Cleaning & ZWNJ Normalization]
    B --> C[Sentence Splitting with Hazm & Sentsplit]
    C --> D[Syntactic Annotation with Stanza]
    D --> E[Named Entity Filtering with HooshvareLab BERT]
    E --> F[Candidate Word Bigram Extraction]
    F --> G[Statistical Association Scoring]
    G --> H[Threshold Filtering & Quality Floor]
    H --> I[Normalization into minmax_score]
    I --> J[PostgreSQL Ingestion with Authentic Citations]
```

### Mathematical Formulation of Metrics:
* **Pointwise Mutual Information (PMI)**:
  $$\text{PMI}(w_1, w_2) = \log_2 \frac{P(w_1, w_2)}{P(w_1)P(w_2)} = \log_2 \frac{N \cdot f(w_1, w_2)}{f(w_1)f(w_2)}$$
* **Student's t-score**:
  $$t = \frac{\bar{x} - \mu}{\sqrt{s^2 / N}} \approx \frac{f(w_1, w_2) - \frac{f(w_1)f(w_2)}{N}}{\sqrt{f(w_1, w_2)}}$$
* **logDice Metric**:
  $$\text{logDice} = 14 + \log_2 \frac{2 f(w_1, w_2)}{f(w_1) + f(w_2)}$$
* **Dunning's Log-Likelihood Ratio (LLR / $G^2$)**:
  $$\text{LLR} = 2 \sum_{i,j} O_{ij} \log \frac{O_{ij}}{E_{ij}}$$

---

## 🏗️ System Architecture & Cloud Topology

```mermaid
flowchart LR
    Client([User Browser / PWA]) -->|HTTPS:443| Vercel[Frontend Vercel / Nginx]
    Vercel -->|/api/* Proxy| Backend[Backend Express API :3000]
    Backend -->|SQL :5432| Postgres[(PostgreSQL 16 Supabase)]
    Backend -->|Internal REST :8001| Agent[Python FastAPI Agent :8001]
    Agent -->|Cache & Flags| Postgres
    Agent -->|Telemetry OTLP| Logfire[Logfire Observability]
    Agent -->|LLM Chain| Gemini[Google Gemini Flash / NVIDIA NIM]
```

---

## 💻 Technology Stack Matrix

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Web App** | React 19, TypeScript, Vite, Tailwind CSS | RTL design system, Vazirmatn typography, PWA manifest |
| **Backend Gateway** | Node.js 22, Express, TypeScript, Zod, pg | Strict validation, timing-safe admin authentication, pg connection pool |
| **AI Agent Service** | Python 3.12, FastAPI, Pydantic AI, asyncpg | Multi-turn chat, fallback model orchestration, sentence workshop |
| **Observability** | Pydantic Logfire | LLM performance monitoring, trace visualization, zero healthcheck noise |
| **Database** | PostgreSQL 16, pg_trgm extension | Trigram indexes, deterministic seeds, full relational integrity |
| **Cloud Hosting** | Vercel, Railway, Supabase Cloud | Distributed production architecture across edge networks |

---

## 🚀 Local Installation & Docker Guide

### Prerequisites
* `Node.js` v20+
* `Python` v3.12+
* `PostgreSQL` v16+
* `Docker` & `Docker Compose` (Optional for containerized execution)

### 1. Clone the Repository
```bash
git clone https://github.com/Pouria26/HamVajeh.git
cd HamVajeh
```

### 2. Environment Configuration
Create a `.env` file in the project root:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/hamvajeh
ADMIN_TOKEN=your_secure_admin_token
GEMINI_API_KEY=your_gemini_api_key
NVIDIA_API_KEY=your_nvidia_api_key_optional
LOGFIRE_TOKEN=your_logfire_token_optional
```

### 3. Run with Docker Compose
```bash
docker compose -f docker-compose.prod.yml up --build -d
```
* **Web Client**: `http://localhost:80`
* **API Gateway**: `http://localhost:3000`
* **Agent Microservice**: `http://localhost:8001`

### 4. Manual Development Setup

#### Start Backend:
```bash
cd backend
npm install
npm run dev
```

#### Start AI Agent:
```bash
cd agent
python -m venv venv
# Windows: .\venv\Scripts\activate | Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

#### Start Frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## 🤝 Contributing & Community

Contributions are warmly welcome! Whether you are an NLP researcher, software engineer, or Persian language enthusiast, you can help make HamVajeh even better:

* 🗄️ **Dataset Improvement**: Suggesting new authentic Persian collocations, reporting subtle corpus anomalies, or refining qualitative tags.
* 💻 **Code Contributions**: Enhancing frontend animations, optimizing PostgreSQL queries, expanding test coverage, or fine-tuning AI agent system prompts.
* 💡 **Feature Requests & Bug Reports**: Found an issue? Have an idea? Feel free to open a [GitHub Issue](https://github.com/Pouria26/HamVajeh/issues) or submit a Pull Request!

⭐ **If you find HamVajeh useful for your research, studies, or projects, please consider giving this repository a Star on GitHub!** Your support helps the platform reach more linguists, students, and developers.

---

## 📜 Academic Citation & License

This project is open-source under the **MIT License**.

If you utilize the HamVajeh platform, dataset, or extraction pipeline in your academic research, please cite:

```bibtex
@software{hamvajeh2026,
  author = {HamVajeh Research Team},
  title = {HamVajeh: An Intelligent Educational & Research Platform for Persian Collocation Extraction and AI-Assisted Tutoring},
  year = {2026},
  url = {https://github.com/Pouria26/HamVajeh}
}
```

---

<div align="center">
  <br/>
  Made with ❤️ by Pouria
</div>
