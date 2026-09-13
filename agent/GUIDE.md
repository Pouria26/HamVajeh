# HamVajeh Persian Collocation AI Service Guide

Technical architecture, setup guide, and API documentation for the natural language processing and educational collocation service of the HamVajeh platform.

---

## Overview

The service provides linguistically grounded Persian collocation intelligence, analysis, and tutoring. Built on top of [Pydantic AI](https://github.com/pydantic/pydantic-ai) and FastAPI, it integrates Google Gemini Flash models with transparent fallback handling and connects directly to the HamVajeh PostgreSQL database for authentic corpus grounding and performance caching.

### Key Capabilities
- **Conversational Collocation Tutor (`/chat`)**: Multi-turn educational assistant that explains Persian collocations, natural usage, registers (formal vs. colloquial), and suggests relevant follow-up learning questions.
- **Exercise Error Explainer (`/explain`)**: Analyzes quiz mistakes against authentic corpus evidence stored in PostgreSQL, with an exact-match cache table (`agent_cache`) to avoid redundant model invocations.
- **High Availability Fallback Chain**: Sequential fallback architecture (`gemini-3.8-flash` → `gemini-3.6-flash` → `gemini-3.5-flash`) with error and timeout recovery.
- **Full-Stack Observability**: Native Logfire instrumentation for real-time span tracking, latency inspection, and token monitoring.

---

## Architecture & Module Structure

```text
agent/
├── agent.py          # Pydantic AI agent definitions, model fallback chain, and system prompts
├── db.py             # asyncpg connection layer, query methods, and cache tables
├── main.py           # FastAPI web application, lifecycle management, and API routes
├── schemas.py        # Pydantic data contracts (ChatMessage, ChatResponse, ExerciseJudgment)
├── settings.py       # Type-safe environment configuration with pydantic-settings
├── test_step1.py     # Automated verification script for single-turn and multi-turn flows
├── requirements.txt  # Pinned Python dependencies
├── .env.example      # Template for environment variables
└── GUIDE.md          # Technical documentation and service manual
```

---

## Setup & Installation

### Prerequisites
- Python 3.11 or 3.12
- PostgreSQL (via `hamvajeh-postgres` Docker container or local instance)
- Google Gemini API key (from [Google AI Studio](https://aistudio.google.com/apikey))

### 1. Create Virtual Environment
```powershell
cd agent
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 2. Install Dependencies
```powershell
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```
Populate the required credentials in `.env`:
```env
DATABASE_URL=postgres://hamvajeh:hamvajeh_secure_pass_2026@localhost:5432/hamvajeh
GOOGLE_API_KEY="your_actual_gemini_api_key"
LOGFIRE_TOKEN="your_logfire_token_if_available"
```

---

## Running the Service

Start the development server with live reload:
```powershell
.\venv\Scripts\uvicorn.exe main:app --port 8001 --reload
```
- **Service Base URL**: `http://127.0.0.1:8001/`
- **Interactive OpenAPI Documentation (Swagger UI)**: `http://127.0.0.1:8001/docs`
- **ReDoc Documentation**: `http://127.0.0.1:8001/redoc`

---

## Running Verification Tests

Run the unified test suite to validate model connections, database tool calling, exact-match caching, and multi-turn context retention:
```powershell
# Run all available test suites (Step 1 & Step 2)
.\venv\Scripts\python.exe test_cases.py

# Or run a specific step individually
.\venv\Scripts\python.exe test_cases.py 1   # Step 1: Chatbot & Fallback
.\venv\Scripts\python.exe test_cases.py 2   # Step 2: Database Tools & Cache
```

---

## API Reference

### 1. Chat Endpoint (`POST /chat`)
Provides multi-turn Persian collocation tutoring with structured follow-ups.

**Request Body:**
```json
{
  "message": "چرا «گاز گرفتن» یک باهم‌آیی است ولی «گاز کردن» نیست؟",
  "history": []
}
```

**Response (`200 OK`):**
```json
{
  "reply": "ترکیب «گاز گرفتن» یک باهم‌آیی مقید فعلی است که در ذهن اهل زبان تثبیت شده...",
  "suggested_followups": [
    "تفاوت باهم‌آیی «گاز گرفتن» و «گاز زدن» چیست؟",
    "چه افعال سبکی با واژه «دندان» هم‌آیی می‌سازند؟"
  ]
}
```

### 2. Exercise Explainer Endpoint (`POST /explain`)
Evaluates user quiz mistakes against database evidence and caches judgments.

**Request Body:**
```json
{
  "example_id": 1,
  "selected_option_id": 2
}
```

### 3. Health & Metrics Endpoint (`GET /health`)
Returns operational status and review flag metrics:
```json
{
  "status": "ok",
  "service": "hamvajeh-agent",
  "flags_logged_today": 0
}
```
