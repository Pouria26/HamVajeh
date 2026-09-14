# HamVajeh («هم‌واژه») — Comprehensive Architecture & Codebase Map

> **Document Version**: 1.0.0 (Production-Grade Reference)  
> **Target Audience**: Software Engineers, AI/NLP Specialists, DevOps Architects, and AI Coding Agents  
> **Engineering Invariant**: Strictly factual and exhaustive technical documentation without subjective hyperbole. Serves as the complete single-source reference for the entire monorepo.

---

## 1. System Overview & Domain Mission

**HamVajeh** («هم‌واژه») is an educational, research, and exploration platform for **Persian Collocations** (باهم‌آیی‌های زبان فارسی). 

A collocation is a sequence or pairing of words that co-occur with significantly greater frequency and native naturalness than random association (e.g., «تصمیم گرفتن» vs. the unnatural calque «تصمیم ساختن» , «تصمیم بودن»).

The platform consists of:
1. **Computational NLP Pipeline**: Statistical extraction of collocations from the Hamshahri newspaper corpus using association measures (PMI, logDice, Student's t-score, LLR).
2. **Backend Gateway**: Production Node.js/Express API with strict Zod validation, pg connection pooling, rate limiting, and admin moderation.
3. **AI Tutor Microservice**: Python 3.12 FastAPI service powered by Pydantic AI, Google Gemini Flash models, NVIDIA NIM fallback, and Logfire cloud observability.
4. **Interactive Web Client & PWA**: React 19 single-page application with RTL typography (Vazirmatn), daily challenges, quiz practice, sentence generator, and multi-session AI tutor chat.
5. **Relational Database & DevOps**: PostgreSQL 16 database, Docker Compose production stack, automated backup daemon, and database restoration tooling.

---

## 2. Global Port & Network Topology

| Service | Internal Container Port | Host Port (Dev / Prod) | Communication Protocol | Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Web / PWA** | `80` (Nginx) / `5173` (Vite) | `80` (Prod) / `3000` (Dev) | HTTP/1.1 (Static SPA + Proxy) | Public internet / Browser |
| **Backend API Gateway** | `3000` | `3000` | HTTP/1.1 REST JSON | Public via Nginx `/api` |
| **AI Agent Microservice** | `8001` | `8001` (Internal) | HTTP/1.1 REST JSON | **Internal only** (Proxied via Backend) |
| **PostgreSQL Database** | `5432` | `5432` (Dev) / `5432` (Host) | PostgreSQL Wire Protocol | Internal backend and agent |
| **PostgreSQL Backup Service**| None (Cron Daemon) | None | Docker internal socket | Automated backup container |

```mermaid
flowchart LR
    Client([User Browser / Mobile PWA]) -->|HTTP:80 / HTTP:3000| Nginx[Frontend Nginx / Vite]
    Nginx -->|SPA Routes / Static Assets| Client
    Nginx -->|/api/* Proxy| Backend[Backend Express API :3000]
    Backend -->|SQL Queries :5432| Postgres[(PostgreSQL 16 DB)]
    Backend -->|Internal REST :8001| Agent[Python FastAPI Agent :8001]
    Agent -->|SQL Cache & Flags :5432| Postgres
    Agent -->|OTLP HTTPS :443| Logfire[Logfire Observability Cloud]
    Agent -->|REST HTTPS :443| Gemini[Google AI Studio / Gemini API]
    Agent -->|REST HTTPS :443| NVIDIA[NVIDIA NIM / Kimi K3]
```

---

## 3. Monorepo Directory Tree & Component Mapping

```
D:/Persian Collocation/
├── .env.example                       # Root local environment template
├── .env.production.example            # Production environment template
├── .gitignore                         # Git exclusion rules
├── AGENTS.md                          # Mandatory agent directives and coding standards
├── IMPLEMENTATION_PLAN.md             # Implementation roadmap and phase checklist
├── PROJECT_MAP.md                     # This comprehensive architectural reference
├── docker-compose.prod.yml            # Production Docker multi-container stack definition
├── build_final_dataset.py             # Utility to merge extracted corpus shards
├── persian_collocation_extraction.ipynb # Academic NLP extraction notebook (INVARIANT)
│
├── agent/                             # Python 3.12 AI Tutor Microservice (Port 8001)
│   ├── .dockerignore                  # Agent docker build exclusions
│   ├── .env                           # Local agent environment secrets
│   ├── .env.example                   # Agent environment template
│   ├── Dockerfile                     # Python 3.12-slim multi-stage image with healthcheck
│   ├── GUIDE.md                       # Internal developer guide for agent service
│   ├── requirements.txt               # Locked dependencies (FastAPI, Pydantic AI, asyncpg, Logfire)
│   ├── settings.py                    # pydantic-settings configuration loader
│   ├── schemas.py                     # Pydantic request/response data contracts
│   ├── db.py                          # asyncpg connection pool, cache, and flagging operations
│   ├── agent.py                       # 3-tier FallbackModel, Pydantic AI agents, system prompts
│   ├── main.py                        # FastAPI endpoints, lifespan management, Logfire spans
│   └── test_cases.py                  # Evaluation prompts and benchmark test cases
│
├── backend/                           # Node.js + Express API Gateway (Port 3000)
│   ├── Dockerfile                     # Node 22 Alpine production build
│   ├── package.json                   # Dependencies: express, pg, zod, helmet, cors, jest
│   ├── tsconfig.json                  # Strict TypeScript configuration
│   ├── tsconfig.build.json            # Build configuration excluding test files
│   ├── tests/                         # 59 Jest integration test suites (100% pass)
│   │   ├── admin.test.ts              # Admin auth, pagination, patching, and bulk clear tests
│   │   ├── agent.test.ts              # Agent validation, proxying, and HTTP 503 fallback tests
│   │   ├── collocations.test.ts       # Search, detail, normalization, and related query tests
│   │   ├── exercises.test.ts          # Quiz questions, option shuffling, and answer check tests
│   │   ├── health.test.ts             # Liveness and database connectivity tests
│   │   └── visibility.test.ts         # Public visibility floor and hidden pair exclusion tests
│   └── src/
│       ├── index.ts                   # Process bootstrap and HTTP server listen
│       ├── app.ts                     # Express app, middleware mounting, and error handling
│       ├── types.ts                   # Backend TypeScript interfaces and types
│       ├── importDataset.ts           # CSV seed parser loading final_df.csv into PostgreSQL
│       ├── db/
│       │   ├── pool.ts                # pg.Pool connection pool instance
│       │   ├── initSchema.ts          # Database DDL initialization script
│       │   ├── schema.sql             # Canonical PostgreSQL DDL definitions
│       │   └── migrations/            # Incremental database migrations
│       │       ├── 001_add_needs_review.sql
│       │       ├── 002_add_reports_table.sql
│       │       ├── run-001.ts
│       │       └── run-002.ts
│       ├── lib/
│       │   ├── patternCategories.ts   # 24 POS patterns mapped to 4 user categories
│       │   ├── scoreDerivation.ts     # Score interpolation for manually-added pairs
│       │   └── visibility.ts          # Strict public visibility floor constant (0.15)
│       ├── middleware/
│       │   ├── adminAuth.ts           # Timing-safe Bearer token authorization
│       │   └── validate.ts            # Generic Zod request validation middleware
│       ├── routes/
│       │   ├── admin.ts               # Dataset curation, moderation, and CSV export
│       │   ├── agent.ts               # Proxy gateway to Python AI service with fallback
│       │   ├── collocations.ts        # Search (pg_trgm), detail, related, patterns
│       │   └── exercises.ts           # Random quiz, answer check, daily challenge (setseed)
│       └── schemas/
│           └── index.ts               # Zod validation schemas for all incoming API payloads
│
├── frontend/                          # React 19 + TypeScript + Vite Client (Port 80 / 3000)
│   ├── Dockerfile                     # Multi-stage Node 22 build -> Nginx Alpine runtime
│   ├── nginx.conf                     # Nginx SPA rewrite rules, gzip compression, cache headers
│   ├── package.json                   # Dependencies: react 19, react-router-dom, react-markdown
│   ├── vite.config.ts                 # Vite bundler, PWA manifest, and Rolldown/Rollup split
│   ├── tailwind.config.js             # RTL layout tokens, brand palette, and typography
│   ├── index.html                     # HTML5 entry with Vazirmatn font preloading
│   └── src/
│       ├── main.tsx                   # React root entry point
│       ├── App.tsx                    # Client-side router, layout wrapper, error boundary
│       ├── index.css                  # Tailwind styles and Vazirmatn Persian typography
│       ├── types.ts                   # Complete frontend TypeScript contracts
│       ├── config.ts                  # Environment configuration (API base URL)
│       ├── api/                       # API HTTP client wrappers
│       │   ├── client.ts              # Axios instance with base URL and timeout interceptors
│       │   ├── admin.ts               # Admin moderation and CSV export API calls
│       │   ├── agent.ts               # AI Tutor (chat, explain, workshop, search assist) API calls
│       │   ├── collocations.ts        # Search, detail, browse, and related API calls
│       │   ├── exercises.ts           # Random exercise and daily challenge API calls
│       │   └── reports.ts             # User issue reporting API calls
│       ├── components/                # Modular UI components
│       │   ├── ChatSidebar.tsx        # Slide-over multi-session AI tutor chat drawer
│       │   ├── CollocationCard.tsx    # Card displaying collocation and qualitative badge
│       │   ├── ErrorBoundary.tsx      # React error boundary preventing white screens
│       │   ├── ExampleCard.tsx        # Display card for corpus sentence examples
│       │   ├── ExerciseExplanationCard.tsx # Markdown card explaining quiz errors via AI
│       │   ├── ExerciseQuestion.tsx   # Interactive multiple-choice question component
│       │   ├── InstallPrompt.tsx      # PWA home screen installation banner
│       │   ├── MarkdownContent.tsx    # Markdown renderer (react-markdown + remark-gfm)
│       │   ├── ReportModal.tsx        # Modal for reporting problematic collocations/sentences
│       │   ├── ScoreBadge.tsx         # Qualitative frequency badge («پرتکرار», «متداول», «عادی»)
│       │   ├── SearchAssistantCard.tsx# AI card explaining zero-hit searches with alternatives
│       │   ├── SearchBox.tsx          # Real-time search input with debounce
│       │   ├── SearchLauncher.tsx     # Keyboard shortcut launcher for quick search
│       │   ├── SentenceWorkshop.tsx   # Register-specific sentence generator (formal/press/daily)
│       │   ├── UpdateToast.tsx        # PWA service worker update notification banner
│       │   ├── layout/                # Header, BottomNav, Footer, PageContainer
│       │   └── ui/                    # Button, Input, Card, Badge, Spinner, States
│       ├── hooks/                     # Custom React hooks
│       │   ├── useChatSessions.ts     # Multi-turn chat persistence in localStorage
│       │   ├── useDebounce.ts         # Input debouncing hook
│       │   └── usePwaInstall.ts       # PWA installation event listener
│       ├── lib/                       # Utility functions
│       │   ├── blankSentence.ts       # Sentence blank token formatting utility
│       │   ├── localHistory.ts        # Local viewing history and daily streak tracking
│       │   ├── patternCategories.ts   # Synchronized category definitions
│       │   ├── patternLabels.ts       # Syntactic POS Persian labels
│       │   └── share.ts               # Web Share API and clipboard copy utilities
│       └── pages/                     # Routed view components
│           ├── Home.tsx               # Hero search, featured showcase collocations, stats
│           ├── Search.tsx             # Live search results with Search Assistant fallback
│           ├── CollocationDetail.tsx  # Detail view with authentic examples, related, workshop
│           ├── DailyChallenge.tsx     # Deterministic 5-question daily challenge with timer & share
│           ├── Exercise.tsx           # Continuous quiz practice with instant AI explanation
│           ├── Browse.tsx             # Grammatical category explorer with pagination
│           ├── Tutor.tsx              # Full-page dedicated AI linguistic tutor
│           ├── Admin.tsx              # Moderation dashboard for inspecting and editing dataset
│           └── NotFound.tsx           # 404 error page
│
└── docker/                            # Production deployment, automated backups, and seed SQL
    ├── DEPLOYMENT.md                  # Comprehensive deployment instructions
    ├── postgres/
    │   ├── init.sql.gz                # Compressed database schema initialization
    │   └── seed.sql                   # SQL seed dataset containing extracted collocations
    ├── scripts/
    │   ├── backup.sh / backup.ps1     # Automated pg_dump backup scripts
    │   └── restore.sh / restore.ps1   # Database restoration scripts
    └── backups/                       # Persistent volume for timestamped SQL dumps
```

---

## 4. NLP Extraction Methodology (`persian_collocation_extraction.ipynb`)

The foundation of the HamVajeh dataset is an academic statistical extraction pipeline applied to the **Hamshahri Corpus** (over 160,000 newspaper articles):

```
Hamshahri XML (.ham)
    │
    ▼
[Text Extraction & ZWNJ Normalization] ──> Repair 'mi/nemi' prefixes & unify Persian characters
    │
    ▼
[Sentence Splitting] ────────────────────> Hazm & Sentsplit (fa)
    │
    ▼
[Neural Annotation] ─────────────────────> Stanza: Tokenization, Lemmatization, Universal POS tags
    │
    ▼
[Named Entity Filtering] ────────────────> Transformers ('HooshvareLab/bert-fa-base-uncased')
    │                                     (Removes PERSON entities to prevent name noise)
    ▼
[Candidate Extraction] ──────────────────> Adjacent word bigrams (w1, w2)
    │
    ▼
[Association Measures Calculation] ──────> Compute PMI, t-score, logDice, LLR
    │
    ▼
[Threshold Filtering] ───────────────────> Minimum corpus frequency and document frequency
    │
    ▼
[Majority-Vote POS] ─────────────────────> Assign dominant syntactic pattern
    │
    ▼
[Score Combination & Normalization] ─────> minmax_score (0.0 to 1.0)
    │
    ▼
[Authentic Sentence Extraction] ─────────> Select up to 5 real sentences per collocation + blanks
```

### Mathematical Formulation of Association Measures

1. **Pointwise Mutual Information (PMI)**:
   $$\text{PMI}(w_1, w_2) = \log_2 \frac{P(w_1, w_2)}{P(w_1)P(w_2)} = \log_2 \frac{N \cdot f(w_1, w_2)}{f(w_1)f(w_2)}$$
   *Quantifies whether words co-occur more frequently than expected by chance. Sensitive to low-frequency pairs.*

2. **Student's t-score**:
   $$t = \frac{\bar{x} - \mu}{\sqrt{s^2 / N}} \approx \frac{f(w_1, w_2) - \frac{f(w_1)f(w_2)}{N}}{\sqrt{f(w_1, w_2)}}$$
   *Measures the statistical confidence that the co-occurrence is non-random, favoring frequent, highly reliable pairings.*

3. **logDice Score**:
   $$\text{logDice} = 14 + \log_2 \frac{2 f(w_1, w_2)}{f(w_1) + f(w_2)}$$
   *Scale-independent and unaffected by corpus size. Theoretical maximum is 14 when words always co-occur exclusively.*

4. **Dunning's Log-Likelihood Ratio (LLR / $G^2$)**:
   $$\text{LLR} = 2 \sum_{i,j} O_{ij} \log \frac{O_{ij}}{E_{ij}}$$
   *Asymptotically $\chi^2$-distributed; provides accurate hypothesis testing for both rare and common bigrams.*

5. **Normalized Composite Score (`minmax_score`)**:
   Linear min-max normalization mapping the composite weighted score to the $[0.0, 1.0]$ range.

---

## 5. Relational Database Schema & Data Models

HamVajeh stores all operational data in PostgreSQL 16. The database uses the `pg_trgm` extension for substring and fuzzy indexing.

```mermaid
erDiagram
    collocations ||--o{ examples : "has many (1 to 5)"
    examples ||--o{ exercise_options : "has 4 options"
    collocations ||--o{ reports : "reported in"
    examples ||--o{ reports : "reported in"
    collocations ||--o{ agent_flags : "flagged in"
    examples ||--o{ agent_flags : "flagged in"

    collocations {
        serial id PK
        integer pair_id UK "Traceability to corpus row"
        text word1 "First lemma or merged compound"
        text word2 "Second lemma (null if merged)"
        text display_form "Canonical presentation text"
        text pos_pattern "Universal POS tag combination"
        text status "'valid' or 'corrected'"
        text correction_note "Human audit notes"
        double_precision pmi "PMI association metric"
        double_precision t_score "Student's t-score"
        double_precision llr "Log-likelihood ratio"
        double_precision logdice "logDice lexical metric"
        double_precision combined_score "Weighted raw composite"
        double_precision minmax_score "Normalized quality score (0-1)"
        boolean needs_review "Flag for curator second look"
        timestamptz created_at
    }

    examples {
        serial id PK
        integer collocation_id FK "References collocations(id)"
        text sentence "Full authentic corpus sentence"
        text blank_sentence "Sentence with target blanked"
        text target_phrase "Correct text filled in blank"
        smallint example_order "Position 1 to 5"
    }

    exercise_options {
        serial id PK
        integer example_id FK "References examples(id)"
        text option_text "Candidate word/phrase"
        smallint option_order "Option order index (1-4)"
        boolean is_correct "True for target phrase"
    }

    reports {
        serial id PK
        integer collocation_id FK "References collocations(id)"
        integer example_id FK "References examples(id)"
        text reason "Category of reported error"
        text comment "User explanation"
        text status "'pending', 'resolved', 'dismissed'"
        timestamptz created_at
    }

    agent_cache {
        integer example_id PK "Exercise example ID"
        integer selected_option_id PK "User selected option ID"
        jsonb result_json "Cached ExerciseJudgment"
        timestamptz created_at
    }

    chat_cache {
        text query_hash PK "SHA256 of normalized message"
        text user_message "Original user question"
        jsonb response_json "Cached ChatResponse"
        timestamptz created_at
    }

    sentence_workshop_cache {
        integer collocation_id PK "Collocation ID"
        text display_form "Canonical collocation string"
        jsonb response_json "Cached SentenceWorkshopResponse"
        timestamptz created_at
    }

    search_assistant_cache {
        text query_hash PK "SHA256 of normalized query"
        text query_text "Original query string"
        jsonb response_json "Cached SearchAssistantResponse"
        timestamptz created_at
    }

    agent_flags {
        serial id PK
        integer collocation_id "Collocation ID"
        integer example_id "Example ID"
        text reasoning "AI explanation for review"
        timestamptz created_at
    }
```

### PostgreSQL Indexes

* `idx_collocations_word1`: B-tree on `collocations(word1)`.
* `idx_collocations_minmax`: B-tree on `collocations(minmax_score DESC)`.
* `idx_collocations_display_trgm`: GIN Trigram index on `collocations USING gin (display_form gin_trgm_ops)`.
* `idx_collocations_word1_trgm`: GIN Trigram index on `collocations USING gin (word1 gin_trgm_ops)`.
* `idx_collocations_word2_trgm`: GIN Trigram index on `collocations USING gin (word2 gin_trgm_ops) WHERE word2 IS NOT NULL`.
* `idx_examples_collocation`: B-tree on `examples(collocation_id)`.
* `idx_options_example`: B-tree on `exercise_options(example_id)`.
* `idx_reports_status`: B-tree on `reports(status)`.

---

## 6. Business Logic, Filters & Quality Thresholds

To maintain high linguistic fidelity and hide noisy long-tail corpus artifacts, the backend enforces standardized thresholds across routes:

| Filter Constant | Numerical Threshold | Target Routes / Usage | Rationale |
| :--- | :--- | :--- | :--- |
| `PUBLIC_MIN_SCORE` | $\ge 0.15$ | `/search`, `/browse`, `/random`, `/:id`, `/related`, `/daily-challenge` | Hard existence floor. Any row with score $< 0.15$ behaves as non-existent (404s, omitted from searches and counts). Only visible in `/admin`. |
| `CHALLENGE_QUALITY_THRESHOLD` | $\ge 0.20$ | `/exercises/daily-challenge`, `/collocations/related` | Guarantees that daily challenges and related items only feature natural, high-frequency collocations. |
| `FEATURED_QUALITY_THRESHOLD` | $\ge 0.40$ | `/collocations/featured` (Homepage) | Restricts homepage display to solid, natural-sounding pairs. Excludes proper nouns (`PROPN`). |
| `FEATURED_SHOWCASE_THRESHOLD`| $\ge 0.60$ | `/collocations/featured` (Showcase slot) | Guarantees that at least one top-tier collocation is present in every batch of homepage cards. |

### Syntactic Category Mapping (`patternCategories.ts`)

The raw extraction yields ~24 distinct Part-of-Speech n-gram tags. These are grouped into 4 learner-facing categories:

1. **`NOUN_NOUN` («ترکیب‌های اسمی»)**: `NOUN+NOUN`, `NOUN+PROPN`, `PROPN+NOUN`, `NOUN` (e.g., «سرمایه‌گذاری», «حقوق بشر»).
2. **`NOUN_ADJ` («ترکیب‌های وصفی»)**: `NOUN+ADJ`, `ADJ+NOUN`, `ADJ+PROPN`, `PROPN+ADJ`, `ADJ+ADJ`, `ADJ` (e.g., «نکته ایمنی», «هوای سرد»).
3. **`VERB_PHRASE` («فعل‌های مرکب»)**: `NOUN+VERB`, `VERB+NOUN`, `PROPN+VERB`, `VERB+PROPN`, `ADJ+VERB`, `ADV+VERB`, `VERB` (e.g., «قرار گرفتن», «دست کشیدن»).
4. **`OTHER` («سایر ترکیب‌ها»)**: Prepositional phrases and irregular syntactic combinations (e.g., «وارد گفتگو»).

### Statistical Metric Encapsulation Policy

Raw mathematical values (`pmi`, `logdice`, `t_score`, and raw decimals) are **strictly forbidden** from being shown to end users. The UI and AI tutor map `minmax_score` exclusively to qualitative Persian tiers:
* $\ge 60$: **«پرتکرار»** (Very Frequent)
* $\ge 40$: **«متداول»** (Common)
* $\ge 15$: **«عادی»** (Standard)
* $< 15$: Filtered out completely.

---

## 7. Backend API Specification (`backend/src/routes/`)

### 7.1 Public Collocation Routes (`/api/collocations`)

* `GET /api/collocations/search?q={query}&limit={20}`:
  * Trigram and ILIKE search with prefix priority.
  * Enforces `minmax_score >= 0.15`.
  * Returns array of collocations with `pattern_category_label`.
* `GET /api/collocations/featured?limit={6}`:
  * Returns random sample of collocations with score $> 0.4$, containing at least one showcase item ($> 0.6$). Excludes `PROPN`.
* `GET /api/collocations/:id`:
  * Returns single collocation with all ordered authentic examples. Returns 404 if below `PUBLIC_MIN_SCORE`.
* `GET /api/collocations/:id/related?limit={6}`:
  * Returns collocations sharing `word1` with score $\ge 0.2$. Excludes the target collocation itself.
* `GET /api/collocations/browse?category={NOUN_NOUN}&limit={20}&offset={0}`:
  * Returns paginated list filtered by syntactic pattern category.
* `GET /api/collocations/patterns`:
  * Returns all 4 categories with total count of valid public collocations in each.

### 7.2 Exercise & Quiz Routes (`/api/exercises`)

* `GET /api/exercises/random`:
  * Returns a single random exercise sentence with 4 shuffled options (1 correct target phrase + 3 corpus distractors).
* `GET /api/exercises/collocation/:collocationId`:
  * Returns all blanked exercise sentences for a specific collocation.
* `POST /api/exercises/:exampleId/check`:
  * Body: `{ optionId: number }`.
  * Returns `{ correct: boolean, correctOptionId: number, targetPhrase: string }`.
* `GET /api/exercises/daily-challenge`:
  * Uses PostgreSQL `SELECT setseed($1)` where `$1` is derived deterministically from the current UTC date string (`dateToSeed("YYYY-MM-DD")`).
  * Generates the **exact same 5 questions** for every user worldwide on that date.
  * Quality bar: `minmax_score > 0.20`.

### 7.3 Admin Moderation Routes (`/api/admin`)

*Protected by `requireAdminAuth` middleware using timing-safe evaluation of `ADMIN_TOKEN`.*

* `GET /api/admin/collocations?search=&status=&needs_review={0|1}&limit={50}&offset={0}`:
  * Returns unfiltered collocations, total match count, and `needsReviewTotal` badge count.
* `POST /api/admin/collocations`:
  * Creates a hand-authored collocation with up to 5 sentences and multiple-choice options in a single SQL transaction.
* `PATCH /api/admin/collocations/:id`:
  * Updates `display_form`, `status`, `correction_note`, `needs_review`, or `minmax_score`. Automatically derives statistical metrics via `deriveScoresFromQuality`.
* `POST /api/admin/collocations/clear-needs-review`:
  * Bulk-clears all `needs_review = true` flags in one atomic transaction.
* `GET /api/admin/export/csv`:
  * Streams full dataset CSV including curation notes, display forms, and review flags.
* `GET /api/admin/reports?status={pending|resolved|dismissed}`:
  * Lists user-submitted reports with associated collocations and examples.
* `PATCH /api/admin/reports/:id`:
  * Updates report status.

### 7.4 AI Agent Gateway Proxy (`/api/agent`)

The Node.js backend acts as a secure, validating proxy to the Python AI microservice, keeping LLM credentials behind the internal network:

* `POST /api/agent/chat` $\rightarrow$ forwards to `agent:8001/chat`
* `POST /api/agent/explain` $\rightarrow$ forwards to `agent:8001/explain`
* `POST /api/agent/sentences` $\rightarrow$ forwards to `agent:8001/sentences`
* `POST /api/agent/search-assist` $\rightarrow$ forwards to `agent:8001/search-assist`
* `GET /api/agent/health` $\rightarrow$ forwards to `agent:8001/health`
* **Timeout & Fallback**: Configured with `AbortSignal.timeout(60000)`. If the Python agent is offline or times out, the gateway catches the error and returns **HTTP 503** with a polite Persian message:
  * *"سرویس دستیار هوشمند در حال حاضر در دسترس نیست. لطفاً دقایقی دیگر مجدداً تلاش فرمایید."*

---

## 8. AI Agent Microservice Deep Dive (`agent/`)

### 8.1 Multi-Tier Fallback Chain

The model chain is initialized in `agent/agent.py` using Pydantic AI's `FallbackModel` with `fallback_on=(Exception,)` to catch network read timeouts (`httpx.ReadTimeout`), connection resets, and HTTP 429 quota exhaustion:

1. **Tier 1 (Primary)**: `GoogleModel("gemini-3.5-flash-lite")` (Google AI Studio: 500 RPD, high Persian speed).
2. **Tier 2 (Secondary Fallback)**: `GoogleModel("gemini-3.1-flash-lite")` (Google AI Studio: 500 RPD backup).
3. **Tier 3 (Tertiary Fallback)**: `OpenAIChatModel("moonshotai/kimi-k3")` via NVIDIA NIM (`https://integrate.api.nvidia.com/v1`). Dynamically activated when `NVIDIA_API_KEY` is provided.

### 8.2 Autonomous Agent Definitions & Capabilities

#### 1. AI Tutor Chatbot (`chatbot_agent`)
* **Prompt Mandate**: Acts as «هم‌یار», an intelligent, warm Persian linguist.
* **Greeting Policy**: Greets only on the very first turn. Never repeats greetings in ongoing sessions.
* **Tool Invocation Policy**:
  - Conceptual or etiquette questions («تفاوت اصطلاح و باهم‌آیی», «احوالپرسی رسمی») are answered directly without database tools.
  - Search queries call `search_collocations` up to 3 times for comparison questions.
* **Database Tools**:
  - `search_collocations(query)`: searches the Hamshahri database.
  - `get_collocation_details(collocation_id)`: fetches frequency levels and examples.
  - `get_collocation_examples(collocation_id)`: fetches raw sentence strings.
* **Guardrail**: All `@agent.tool` functions check `if ctx.deps is None or getattr(ctx.deps, "db", None) is None:` on line 1.
* **Execution Limit**: `UsageLimits(request_limit=15)`. Catches `UsageLimitExceeded` and returns a direct linguistic fallback without HTTP 500.

#### 2. Quiz Mistake Explainer (`exercise_agent`)
* Evaluates why a user's selected choice was incorrect compared to the database answer.
* Analyzes syntax, semantic constraints, and native speech habits.
* Sets `flag_for_review = true` if the question has multiple valid answers or the corpus sentence is flawed.
* Outputs `ExerciseJudgment`: `{ verdict, linguistic_reasoning, user_facing_answer, flag_for_review }`.
* When flagged, automatically inserts a record into `agent_flags`.

#### 3. Sentence Workshop (`sentence_workshop_agent`)
* Generates 3 register-specific sentences for any collocation:
  1. `formal` («بافت رسمی و اداری»): administrative, legal, corporate communications.
  2. `journalistic` («بافت مطبوعاتی و تحلیلی»): editorial, economic analysis, academic text.
  3. `daily` («بافت روزمره و روایی»): conversational narrative, natural dialogue.
* Provides a 1-2 sentence linguistic explanation of why the collocation fits that register.

#### 4. Intelligent Search Assistant (`search_assistant_agent`)
* Triggered automatically when a user search yields 0 hits in PostgreSQL.
* Classifies the input into 5 linguistic categories:
  1. `unnatural_combination`: calques («تصمیم ساختن»), keyboard errors (QWERTY: `sghl`), Finglish (`dast zadan`), spelling mistakes («سپاسگذار»).
  2. `compound_word`: compound words incorrectly searched as collocations («بازارگرمی», «دلگرمی»).
  3. `colloquial`: spoken Persian expressions («سرکار رفت», «دمت گرم»).
  4. `free_combination`: grammatically free syntactic pairings («کتاب خوب», «هوای سرد»).
  5. `valid_not_in_db`: authentic Persian collocations missing from the Hamshahri corpus, or English translation requests («make a decision»).
* Output: `badge_label`, `summary`, `linguistic_analysis`, `suggested_collocations` (multi-word only), `example_sentence`.

---

## 9. Observability & Telemetry Reference (Logfire)

Telemetry is configured in `agent/main.py`:

```python
logfire.configure(
    service_name="hamvajeh-agent-service",
    token=settings.logfire_token,
    send_to_logfire="if-token-present",
)
logfire.instrument_pydantic_ai()
```

### Noise Suppression Architecture
* `logfire.instrument_fastapi(app)` is **deliberately omitted**.
* Docker health checks (`GET /health` every 10s) and static pings **never emit spans**.
* Only genuine LLM agent calls and explicit business spans are captured.

### Structured Span Attributes

| Span Name | Attributes Recorded |
| :--- | :--- |
| `هم‌یار - چت کاربر: {query}` | `user_message`, `history_turns`, `agent.reply`, `agent.suggested_followups`, `cache_hit` |
| `هم‌یار - تحلیل تمرین: {sentence}` | `example_id`, `selected_option_id`, `collocation_id`, `collocation_display`, `selected_word`, `correct_word`, `verdict`, `flag_for_review`, `linguistic_reasoning`, `user_facing_answer`, `cache_hit` |
| `هم‌یار - کارگاه جمله‌ساز: {collocation}` | `collocation_id`, `display_form`, `generated_sentences`, `cache_hit` |
| `هم‌یار - تحلیل جستجو: {query}` | `query`, `status_type`, `badge_label`, `summary`, `linguistic_analysis`, `suggested_collocations`, `example_sentence`, `cache_hit` |

### Custom Production Dashboard

* **Dashboard Slug**: `hamvajeh-ai-analytics`
* **Dashboard Name**: `HamVajeh AI Analytics`
* **Panels**:
  1. `recent-queries`: Table of recent user queries, classifications, and summaries.
  2. `search-status-dist`: Table of search classifications (`unnatural_combination`, `valid_not_in_db`, etc.).
  3. `flagged-questions`: Table of quiz questions flagged by the AI Tutor as problematic (`flag_for_review = true`).

---

## 10. Frontend Architecture & State Management (`frontend/src/`)

### 10.1 UI Design System & Styling
* **Framework**: Tailwind CSS configured for RTL directionality (`dir="rtl"`).
* **Typography**: Vazirmatn font preloaded with font-display swap.
* **Palette**:
  - `brand`: Primary teal (`#0d9488` / `brand-600`) representing academic precision.
  - `ink`: Neutral slate for text contrast (`ink-900` to `ink-50`).
* **Markdown Renderer**: `MarkdownContent.tsx` uses `react-markdown` and `remark-gfm` with RTL Persian typography.

### 10.2 State Management & Hooks
* **`useChatSessions`**:
  - Manages multiple concurrent conversation threads with the AI Tutor.
  - Automatically derives session titles from the first prompt (cleaning greetings and punctuation).
  - Persists sessions in `localStorage` under `hamvajeh_tutor_sessions_v2`.
* **`useDebounce`**:
  - 300ms debounce on search input to prevent rapid server queries.
* **`localHistory`**:
  - Tracks recently viewed collocations and stores quiz streak counts in `localStorage`.
* **PWA & Offline**:
  - Configured with `vite-plugin-pwa` generating `sw.js` and Workbox precaching.
  - Offline fallback with prompt to update via `UpdateToast.tsx`.

---

## 11. Production DevOps & Automated Backup Infrastructure

### 11.1 Docker Multi-Container Topology (`docker-compose.prod.yml`)

The production deployment runs 5 isolated services:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/postgres:/docker-entrypoint-initdb.d:ro

  postgres-backup:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - ./docker/backups:/backups
      - ./docker/scripts/backup.sh:/backup.sh:ro
    entrypoint: ["/bin/sh", "-c", "chmod +x /backup.sh && echo '0 3 * * * /backup.sh' | crontab - && crond -f -L /dev/stdout"]

  agent:
    build:
      context: ./agent
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgres://hamvajeh:hamvajeh@postgres:5432/hamvajeh
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - NVIDIA_API_KEY=${NVIDIA_API_KEY:-}
      - LOGFIRE_TOKEN=${LOGFIRE_TOKEN:-}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://hamvajeh:hamvajeh@postgres:5432/hamvajeh
      - AGENT_SERVICE_URL=http://agent:8001
      - ADMIN_TOKEN=${ADMIN_TOKEN}

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "80:80"
```

### 11.2 Automated Backup & Disaster Recovery
* Backups run daily at 03:00 UTC via the `postgres-backup` container.
* Scripts in `docker/scripts/`:
  - `backup.sh` / `backup.ps1`: Generates gzip-compressed SQL dumps (`hamvajeh_backup_YYYYMMDD_HHMMSS.sql.gz`) and deletes dumps older than 14 days.
  - `restore.sh` / `restore.ps1`: Validates file existence and restores database from a designated archive.

---

## 12. Non-Negotiable Engineering Invariants

1. **Language & Comments**:
   - Source code, variable names, functions, docstrings, commit messages, and comments **MUST ALWAYS be in English**.
   - Persian is strictly reserved for user-facing UI labels, error messages, and system prompt instructions.
2. **Academic Research Notebook Invariant (`persian_collocation_extraction.ipynb`)**:
   - Code cells and cell outputs in this notebook must **never be modified, reordered, or deleted**.
3. **Database Exclusivity**:
   - All runtime reads and writes must target the active PostgreSQL database. Never read from or write to static `.csv` files at runtime.
4. **Encapsulation of Statistical Scores**:
   - Raw metrics (`pmi`, `logdice`, `t_score`) must never be exposed to users. Always use qualitative tiers («پرتکرار», «متداول», «عادی»).
5. **Agent Tool Null Safety**:
   - Every `@agent.tool` must check `if ctx.deps is None or getattr(ctx.deps, "db", None) is None:` as its first line.
6. **Graceful Degradation**:
   - If the AI Agent service is unreachable, the backend must return HTTP 503 with a friendly Persian fallback message without crashing or returning an unhandled 500 error.
