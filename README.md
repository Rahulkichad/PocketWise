# PocketWise – AI-driven Personal Finance for India

PocketWise is a microservice-style, production-ready personal finance management platform tailored for the Indian market.

Tech Stack:
- Frontend: React + Tailwind CSS
- Backend: Node.js + Express + MongoDB (Mongoose)
- AI/ML Microservice: Python (FastAPI)
- Charts: Recharts
- Auth: JWT (role-based: User/Admin)

Core Features:
- Register/Login with JWT
- User profile: income, age, risk profile, goals
- Income & expense CRUD with category tagging (Needs/Wants/Savings)
- Smart salary split logic using income-based rules
- AI recommendation engine (SIP, PPF, NPS, ELSS) with inflation & tax awareness (80C/80D)
- Monthly wealth projection & goal tracking
- Dashboard with charts (income split, savings growth, projections)
- Notification service (monthly updates simulation)
- Admin panel: view users and trigger mock model retraining

## Monorepo Structure
```
project1/
  backend/
  ml/
  frontend/
  docker-compose.yml
  README.md
```

## Quick Start (Local)
1) Prerequisites: Node 18+, Python 3.10+, MongoDB (or use docker-compose)

2) Start MongoDB (option A: local) or use docker-compose (option B)
- Option A: Ensure MongoDB is running at mongodb://localhost:27017
- Option B: `docker compose up -d mongodb`

3) Backend
```
cd backend
cp .env.example .env
npm install
npm run dev
```

4) ML Service
```
cd ml
cp .env.example .env  # optional
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

5) Frontend
```
cd frontend
cp .env.example .env
npm install
npm run dev
```

6) Access
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/v1
- ML Service: http://localhost:8001

## Docker Compose (All Services)
```
docker compose up --build
```
Services:
- mongodb: MongoDB database
- backend: Node.js API
- ml: FastAPI microservice
- frontend: React app served by Vite dev server

## Environment
- backend/.env
```
PORT=8000
MONGO_URI=mongodb://mongodb:27017/pocketwise
JWT_SECRET=dev_secret_change_me
ML_SERVICE_URL=http://ml:8001
CORS_ORIGIN=http://localhost:5173
```

- ml/.env (optional)
```
PORT=8001
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8000
INFLATION_RATE=0.06
```

- frontend/.env
```
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Seed Data
From backend:
```
npm run seed
```
Creates demo admin and user accounts with sample transactions.

## Notes
- This project provides clear separation between frontend, backend, and ML microservice.
- Finance defaults reflect common Indian instruments and tax rules (80C/80D caps).
- Charts are powered by Recharts.

## API Overview
- Backend base URL: `http://localhost:8000/api/v1`
- ML Service base URL: `http://localhost:8001`
- Auth: JWT required for protected routes (send `Authorization: Bearer <token>`)

Backend route groups:
- `/auth` login/register
- `/users` profile and settings
- `/transactions` CRUD transactions
- `/budgets` monthly category budgets
- `/goals` savings goals
- `/analytics` aggregates/insights
- `/chat` proxy to ML chat endpoints
- `/ai`, `/protection`, `/notifications`, `/recurring`, `/accounts`, `/categories`, `/subcategories`

## Chat Contract
- Endpoint: Backend `POST /api/v1/chat`
- Body: `{ "message": "<your question>" }`
- Returns strict JSON shape:
```
{ "data": {}, "explanation": "", "recommendation": "" }
```
- Deterministic handlers run before LLM for finance queries like:
  - Total income/expenses/savings for current month
  - Total income/expenses/savings last N months (sum)
  - Category spending (Needs/Wants/Savings)
  - Budget limits and remaining
  - Investments this month (from Savings)
  - Goals progress list
  - Trend: income | expenses | savings for last N months
- Data sourcing priority: Transactions → Budgets → Goals → Profile
- If required data is missing: `explanation` is exactly "Data not available for this request. Please add transactions." and `data` is `{}`.

Example:
```
curl -H "Authorization: Bearer <JWT>" \
     -H "Content-Type: application/json" \
     -d '{"message":"Total expenses last 5 months"}' \
     http://localhost:8000/api/v1/chat
```

## ML Service Endpoints
- `GET /health`
  - Returns status and LLM connectivity info.
- `POST /bias`
  - Input: `{ "features": { ... }, "userId": "optional" }`
  - Output: `{ "bias": { "equityBias": number, "debtBias": number, "taxBias": number }, "bounds": { "min": -0.05, "max": 0.05 }, "explain": {...} }`
- `POST /recommend`
  - Input: `{ "monthlyIncome": number, "age": number, "riskProfile": "Conservative|Moderate|Aggressive", "goals": [ ... ] }`
  - Output: recommended monthly allocations across SIP/PPF/NPS/ELSS with 80C/80CCD(1B) caps.
- `POST /retrain`
  - Mock retrain trigger (returns status).
- `POST /chat`
  - Input: `{ "userId": "<mongo id>", "message": "<question>" }`
  - Output: Strict `{ data, explanation, recommendation }` per Chat Contract above.

## Dev Scripts
- Backend:
  - `npm run dev` start dev server with nodemon
  - `npm run start` start production server
  - `npm run seed` load demo data
  - `npm run seed:reset` full reset + seed
- Frontend:
  - `npm run dev` start Vite dev server
  - `npm run build` production build
  - `npm run preview` preview build
- ML:
  - `uvicorn main:app --reload --host 0.0.0.0 --port 8001`

## Environment Variables
- Backend (`backend/.env`)
  - `PORT=8000`
  - `MONGO_URI=mongodb://localhost:27017/pocketwise` (or docker: `mongodb://mongodb:27017/pocketwise`)
  - `JWT_SECRET=...`
  - `ML_SERVICE_URL=http://localhost:8001`
  - `CORS_ORIGIN=http://localhost:5173`
- ML (`ml/.env`)
  - `PORT=8001`
  - `MONGO_URI=mongodb://localhost:27017/pocketwise` (or docker: `mongodb://mongodb:27017/pocketwise`)
  - `ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8000`
  - `INFLATION_RATE=0.06`
  - `OLLAMA_URL=http://localhost:11434`
  - `OLLAMA_MODEL=llama3`
  - `TIMEZONE=Asia/Kolkata`
  - `BIAS_MODEL_PATH=/app/models` (optional; xgboost boosters)
- Frontend (`frontend/.env`)
  - `VITE_API_BASE_URL=http://localhost:8000/api/v1`

## Data Seeding
- `cd backend && npm run seed`
- Creates demo admin/user, budgets, transactions, and goals with multi-month history.

## Docker Compose
- Start all services (MongoDB, Backend, ML, Ollama, Frontend):
```
docker compose up --build
```
- Access:
  - Frontend: http://localhost:5173
  - Backend API: http://localhost:8000/api/v1
  - ML Service: http://localhost:8001
  - Ollama: http://localhost:11434
