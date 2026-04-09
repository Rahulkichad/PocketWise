from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal
import os
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import re
import math
from pymongo import MongoClient
from bson import ObjectId
import requests
try:
    import xgboost as xgb
except:
    xgb = None

INFLATION_RATE = float(os.getenv("INFLATION_RATE", "0.06"))
PORT = int(os.getenv("PORT", "8001"))
origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8000").split(",")]
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/pocketwise")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
TIMEZONE = os.getenv("TIMEZONE", "Asia/Kolkata")
LOCAL_TZ = ZoneInfo(TIMEZONE)
BIAS_MODEL_PATH = os.getenv("BIAS_MODEL_PATH", "")
BIAS_FEATURES = ["age","riskProfile","monthlyIncome","investableMonthly","goalCount","savingsRate","volatilityTolerance","taxUsageRatio","timeHorizon"]
bias_models = {"equity": None, "debt": None, "tax": None}
POCKETWISE_CODEX_PROMPT = """You are an AI fintech query engine for PocketWise.

You work with:
1. Deterministic backend APIs (already implemented)
2. MongoDB transaction data
3. LLM reasoning for general queries

GOAL:
- Understand user query
- Decide the correct response path
- Return structured JSON response

DECISION LOGIC:

1. If query is about:
   - income, expenses, savings, transactions, trends, budgets, goals
   → Return structured data response

2. If query is about:
   - "what is", "explain", "define", "how", "in detail"
   → Treat as GENERAL CONCEPT → Explain clearly

3. If data is missing:
   → Return:
   "Data not available for this request. Please add transactions."

STRICT RULES:

- ALWAYS return valid JSON
- NEVER return plain text
- NEVER return empty response
- NEVER ask user to rephrase
- NEVER hallucinate data
- DO NOT modify backend logic
- Keep explanation concise (2–3 lines)
- Give 1–2 practical recommendations

OUTPUT FORMAT (MANDATORY):

{
  "data": {},
  "chart": {
    "type": "line|bar|pie",
    "labels": [],
    "values": []
  },
  "explanation": "",
  "recommendation": ""
}

CHART RULES:

- Trend → line chart
- Category breakdown → pie chart
- Comparison → bar chart
- If no chart needed → return empty {}

CONCEPT RESPONSE RULES:

- Explain clearly in simple terms
- No technical jargon unless needed
- If user says "in detail" → expand explanation
- Example must be practical

FAILSAFE:

- If unsure → still return best possible JSON
- NEVER break JSON format"""

def _encode_risk(r: str) -> float:
    m = {"Conservative": 0.0, "Moderate": 0.5, "Aggressive": 1.0}
    return m.get(r or "Moderate", 0.5)

def _models_dir() -> str:
    if BIAS_MODEL_PATH and os.path.isdir(BIAS_MODEL_PATH):
        return BIAS_MODEL_PATH
    base = os.path.dirname(__file__)
    p = os.path.join(base, "models")
    return p

def _load_bias_models():
    if not xgb:
        return
    d = _models_dir()
    e = os.path.join(d, "equity.json")
    b = os.path.join(d, "debt.json")
    t = os.path.join(d, "tax.json")
    if os.path.isfile(e):
        m = xgb.Booster()
        m.load_model(e)
        bias_models["equity"] = m
    if os.path.isfile(b):
        m = xgb.Booster()
        m.load_model(b)
        bias_models["debt"] = m
    if os.path.isfile(t):
        m = xgb.Booster()
        m.load_model(t)
        bias_models["tax"] = m

_load_bias_models()

app = FastAPI(title="PocketWise ML Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mongo_client = MongoClient(MONGO_URI)
db = mongo_client.get_default_database()


class Goal(BaseModel):
    name: str
    targetAmount: float
    targetDate: datetime
    monthlyRequired: Optional[float] = None
    monthlyPlan: Optional[float] = None
    progress: Optional[float] = 0.0


class RecommendRequest(BaseModel):
    monthlyIncome: float = Field(ge=0)
    age: int = Field(ge=0)
    riskProfile: Literal["Conservative", "Moderate", "Aggressive"]
    goals: Optional[List[Goal]] = []
    targetGoalId: Optional[str] = None


def calculate_goal_required(target_amt: float, target_date: datetime, progress: float = 0.0) -> float:
    now = datetime.now(timezone.utc)
    if target_date.tzinfo is None:
        target_date = target_date.replace(tzinfo=timezone.utc)
    
    # Use 30-day month logic similar to frontend for consistency
    days_until = (target_date - now).days
    months_until = math.ceil(days_until / 30) if days_until > 0 else 0
    
    remaining = max(0.0, target_amt - progress)
    if months_until <= 0:
        return remaining
    
    return round(remaining / months_until, 2)


def smart_salary_split(income: float) -> Dict[str, float]:
    if income <= 30000:
        return {"Needs": 0.6, "Wants": 0.25, "Savings": 0.15}
    if income <= 70000:
        return {"Needs": 0.5, "Wants": 0.3, "Savings": 0.2}
    return {"Needs": 0.4, "Wants": 0.3, "Savings": 0.3}


def risk_allocation(risk: str, age: int) -> Dict[str, float]:
    # Base weights for monthly investment bucket
    base = {
        "Conservative": {"SIP": 0.40, "PPF": 0.35, "NPS": 0.20, "ELSS": 0.05},
        "Moderate": {"SIP": 0.50, "PPF": 0.25, "NPS": 0.15, "ELSS": 0.10},
        "Aggressive": {"SIP": 0.65, "PPF": 0.10, "NPS": 0.10, "ELSS": 0.15},
    }[risk]
    # Age tilt: more equity when younger, more fixed when older
    if age < 30:
        base["SIP"] += 0.05
        base["PPF"] -= 0.03
        base["NPS"] -= 0.01
        base["ELSS"] -= 0.01
    elif age > 45:
        base["SIP"] -= 0.05
        base["PPF"] += 0.03
        base["NPS"] += 0.01
        base["ELSS"] += 0.01
    # Normalize to 1
    total = sum(base.values())
    return {k: v / total for k, v in base.items()}


def apply_tax_caps(monthly_alloc: Dict[str, float]) -> Dict[str, float]:
    """
    Apply simplified Indian tax caps:
    - 80C cap 1.5L/yr for PPF+ELSS combined
    - 80CCD(1B) cap 50k/yr additional for NPS (not combined with 80C)
    """
    cap_80c_month = 150000 / 12.0
    cap_80ccd1b_month = 50000 / 12.0

    ppf = monthly_alloc.get("PPF", 0.0)
    elss = monthly_alloc.get("ELSS", 0.0)
    nps = monthly_alloc.get("NPS", 0.0)

    # Constrain PPF+ELSS
    total_80c = ppf + elss
    if total_80c > cap_80c_month:
        scale = cap_80c_month / total_80c
        ppf *= scale
        elss *= scale

    # Constrain NPS under 80CCD(1B)
    if nps > cap_80ccd1b_month:
        nps = cap_80ccd1b_month

    out = dict(monthly_alloc)
    out["PPF"] = round(ppf, 2)
    out["ELSS"] = round(elss, 2)
    out["NPS"] = round(nps, 2)
    return out


def check_llm() -> bool:
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        return r.ok
    except:
        return False

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "ml",
        "inflation": INFLATION_RATE,
        "llm_online": check_llm(),
        "model": OLLAMA_MODEL,
        "ollama_url": OLLAMA_URL
    }

class BiasRequest(BaseModel):
    features: Dict[str, float | str]
    userId: Optional[str] = None

@app.post("/bias")
async def bias(req: BiasRequest):
    min_b = -0.05
    max_b = 0.05
    equity = 0.0
    debt = 0.0
    tax = 0.0
    explain = {"source": "fallback"}
    if xgb and not (bias_models["equity"] and bias_models["debt"] and bias_models["tax"]):
        _load_bias_models()
    if xgb and (bias_models["equity"] and bias_models["debt"] and bias_models["tax"]):
        v = []
        for k in BIAS_FEATURES:
            if k == "riskProfile":
                v.append(_encode_risk(str(req.features.get(k) or "")))
            else:
                try:
                    v.append(float(req.features.get(k) or 0.0))
                except:
                    v.append(0.0)
        dm = xgb.DMatrix([v], feature_names=BIAS_FEATURES)
        pe = bias_models["equity"].predict(dm)
        pd = bias_models["debt"].predict(dm)
        pt = bias_models["tax"].predict(dm)
        equity = float(pe[0])
        debt = float(pd[0])
        tax = float(pt[0])
        ce = bias_models["equity"].predict(dm, pred_contribs=True)[0]
        cd = bias_models["debt"].predict(dm, pred_contribs=True)[0]
        ct = bias_models["tax"].predict(dm, pred_contribs=True)[0]
        idxs = list(range(len(BIAS_FEATURES)))
        top_e = sorted([(BIAS_FEATURES[i], float(ce[i])) for i in idxs], key=lambda x: abs(x[1]), reverse=True)[:3]
        top_d = sorted([(BIAS_FEATURES[i], float(cd[i])) for i in idxs], key=lambda x: abs(x[1]), reverse=True)[:3]
        top_t = sorted([(BIAS_FEATURES[i], float(ct[i])) for i in idxs], key=lambda x: abs(x[1]), reverse=True)[:3]
        explain = {"source": "model", "equity": top_e, "debt": top_d, "tax": top_t}
    eb = max(min_b, min(max_b, equity))
    db = max(min_b, min(max_b, debt))
    tb = max(min_b, min(max_b, tax))
    return {
        "bias": {
            "equityBias": eb,
            "debtBias": db,
            "taxBias": tb,
        },
        "bounds": {"min": min_b, "max": max_b},
        "explain": explain,
    }


@app.post("/recommend")
async def recommend(req: RecommendRequest):
    split = smart_salary_split(req.monthlyIncome)
    investable = req.monthlyIncome * split["Savings"]
    weights = risk_allocation(req.riskProfile, req.age)

    raw_alloc = {k: round(investable * w, 2) for k, w in weights.items()}
    capped = apply_tax_caps(raw_alloc)

    # If targetGoalId is provided, we prioritize that goal's requirement
    goal_hints = []
    if req.goals:
        for g in req.goals:
            g_dt = g.targetDate
            if g_dt.tzinfo is None:
                g_dt = g_dt.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            days = (g_dt.astimezone(timezone.utc) - now).days
            
            # Dynamic vehicle suggestion based on horizon
            if days > 365 * 5:
                vehicle = "ELSS"
            elif days > 365 * 2:
                vehicle = "SIP"
            elif days > 365:
                vehicle = "NPS"
            else:
                vehicle = "PPF"

            required = calculate_goal_required(g.targetAmount, g_dt, g.progress or 0.0)
            
            hint = {
                "name": g.name,
                "targetAmount": g.targetAmount,
                "targetDate": g_dt.isoformat(),
                "suggestedVehicle": vehicle,
                "monthlyRequired": required,
                "recommendedAmount": min(required, investable * 0.9) # Cap single goal at 90% of investable
            }
            goal_hints.append(hint)

    instruments = [
        {"type": "SIP", "monthlyAmount": round(capped.get("SIP", 0), 2), "rationale": "Core equity growth aligned to risk"},
        {"type": "PPF", "monthlyAmount": round(capped.get("PPF", 0), 2), "rationale": "Tax-free fixed income under 80C"},
        {"type": "NPS", "monthlyAmount": round(capped.get("NPS", 0), 2), "rationale": "80CCD(1B) additional tax benefit"},
        {"type": "ELSS", "monthlyAmount": round(capped.get("ELSS", 0), 2), "rationale": "Equity-linked tax saving under 80C"},
    ]

    response = {
        "recommendedSplit": {"needsPct": split["Needs"], "wantsPct": split["Wants"], "savingsPct": split["Savings"]},
        "monthlyIncome": req.monthlyIncome,
        "investableMonthly": round(investable, 2),
        "instruments": instruments,
        "taxOptimization": {"section80C": 150000, "section80D": 25000 if req.age < 60 else 50000},
        "assumptions": {
            "inflationRate": INFLATION_RATE,
            "model": "rule-based-baseline",
        },
        "notes": [
            "Respects 80C/80CCD(1B) caps; optimize PPF/ELSS/NPS before equity overflow",
            f"Risk profile: {req.riskProfile} with age tilt applied",
        ],
        "goalHints": goal_hints
    }

    return response


@app.post("/retrain")
async def retrain():
    # Mock retrain; in real life this would schedule a job
    return {"status": "ok", "message": "Retraining triggered (mock)", "version": "rule-based-baseline"}


class ChatRequest(BaseModel):
    userId: str
    message: str

sessions: Dict[str, Dict] = {}

def _respond(uid_str: str, topic: str, intent: str, res: Dict) -> Dict:
    s = sessions.setdefault(uid_str, {})
    prev_topic = s.get("last_topic")
    if prev_topic != topic:
        s["detail_depth"] = 0
    s["last_topic"] = topic
    s["last_intent"] = intent
    s["last_payload"] = res
    return res

def is_followup(text: str) -> bool:
    t = (text or "").strip().lower()
    if not t:
        return False
    short_followups = {
        "more",
        "detail",
        "details",
        "deeper",
        "continue",
        "go on",
        "elaborate",
        "expand"
    }
    if t in short_followups:
        return True
    phrases = [
        "in detail",
        "in depth",
        "more detail",
        "more details",
        "explain more",
        "explain this more",
        "explain this in detail",
        "can you explain more",
        "can you explain this more",
        "can you expand",
        "can you elaborate",
        "please elaborate",
        "please expand",
        "elaborate more",
        "expand more",
        "tell me more",
        "go deeper",
        "continue this",
        "continue with this"
    ]
    if any(p in t for p in phrases):
        return True
    return bool(re.fullmatch(r"(please\s+)?(explain|elaborate|expand)(\s+(this|that|it))?(\s+(more|further))?\??", t))

def llm_generate_topic(prev: Dict, default_topic: str) -> str:
    try:
        prompt = (
            "Derive a concise 3–6 word topic/title for the prior answer.\n"
            "Return ONLY the title text without punctuation.\n"
            f"Prior JSON:\n{prev}\n"
        )
        body = {"model": OLLAMA_MODEL, "prompt": prompt, "stream": False}
        r = requests.post(f"{OLLAMA_URL}/api/generate", json=body, timeout=8)
        if r.ok:
            resp = r.json().get("response", "").strip()
            return resp[:48] or default_topic
        return default_topic
    except:
        return default_topic

ALLOWED = [
    "budget","budgets","remaining","overspent","spent","spend",
    "goal","goals","progress",
    "investment","investments","investable",
    "savings","income","expense",
    "cashflow","cash flow",
    "tax","ppf","elss","nps","sip",
    "transaction","transactions"
]


def in_scope(text: str) -> bool:
    t = (text or "").lower()
    return any(k in t for k in ALLOWED)


def month_bounds(now: datetime) -> tuple[datetime, datetime]:
    start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    if now.month == 12:
        end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
    return start, end

def day_bounds(now: datetime) -> tuple[datetime, datetime]:
    start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return start, end

def day_bounds_local(dt: datetime, tz: ZoneInfo) -> tuple[datetime, datetime]:
    local = dt.astimezone(tz)
    start_local = datetime(local.year, local.month, local.day, tzinfo=tz)
    end_local = start_local + timedelta(days=1)
    start_utc = start_local.astimezone(timezone.utc)
    end_utc = end_local.astimezone(timezone.utc)
    return start_utc, end_utc

def add_months(dt: datetime, n: int) -> datetime:
    y = dt.year + (dt.month - 1 + n) // 12
    m = ((dt.month - 1 + n) % 12) + 1
    return datetime(y, m, 1, tzinfo=timezone.utc)

def year_bounds(now: datetime) -> tuple[datetime, datetime]:
    start = datetime(now.year, 1, 1, tzinfo=timezone.utc)
    end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    return start, end

def iter_months(start: datetime, end: datetime) -> List[tuple[int, int]]:
    cur = datetime(start.year, start.month, 1, tzinfo=timezone.utc)
    out = []
    while cur < end:
        out.append((cur.year, cur.month))
        cur = add_months(cur, 1)
    return out

def parse_time_window(text: str) -> Optional[tuple[datetime, datetime, str]]:
    t = (text or "").lower()
    now = datetime.now(timezone.utc)
    if "last 6 month" in t or "last 6 months" in t:
        base = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        start = add_months(base, -6)
        end = add_months(base, 1)
        return start, end, "last 6 months"
    if "last month" in t:
        base = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        start = add_months(base, -1)
        end = base
        return start, end, "last month"
    if "this month" in t or "month" in t and ("this" in t or "current" in t):
        start, end = month_bounds(now)
        return start, end, "this month"
    m = re.search(r"\bthis year\b", t)
    if m or (" year" in t and ("this" in t or "current" in t)):
        start, end = year_bounds(now)
        return start, end, f"{now.year}"
    m = re.search(r"\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+to\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?\b", t)
    if m:
        mon_map = {
            "jan": 1, "january": 1,
            "feb": 2, "february": 2,
            "mar": 3, "march": 3,
            "apr": 4, "april": 4,
            "may": 5,
            "jun": 6, "june": 6,
            "jul": 7, "july": 7,
            "aug": 8, "august": 8,
            "sep": 9, "sept": 9, "september": 9,
            "oct": 10, "october": 10,
            "nov": 11, "november": 11,
            "dec": 12, "december": 12,
        }
        ms = mon_map[m.group(1)[:3]] if m.group(1) else None
        me = mon_map[m.group(2)[:3]] if m.group(2) else None
        y = int(m.group(3)) if m.group(3) else now.year
        if ms and me:
            start = datetime(y, ms, 1, tzinfo=timezone.utc)
            end = add_months(datetime(y, me, 1, tzinfo=timezone.utc), 1)
            label = f"{m.group(1).title()} to {m.group(2).title()} {y}"
            return start, end, label
    if "year" in t and re.search(r"\b\d{4}\b", t):
        y = int(re.search(r"\b(\d{4})\b", t).group(1))
        start = datetime(y, 1, 1, tzinfo=timezone.utc)
        end = datetime(y + 1, 1, 1, tzinfo=timezone.utc)
        return start, end, f"{y}"
    return None

def parse_spelled_date(text: str) -> Optional[datetime]:
    m = re.search(r"(?:on|of|for)\s+(\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]{3,9}\s+\d{2,4})", text)
    if not m:
        return None
    raw = m.group(1).strip()
    parts = re.split(r"\s+", raw)
    if len(parts) < 3:
        return None
    dd = parts[0].lower()
    dd = re.sub(r"(st|nd|rd|th)$", "", dd)
    try:
        d = int(dd)
    except:
        return None
    mon_name = parts[1].lower()
    mon_map = {
        "jan": 1, "january": 1,
        "feb": 2, "february": 2,
        "mar": 3, "march": 3,
        "apr": 4, "april": 4,
        "may": 5,
        "jun": 6, "june": 6,
        "jul": 7, "july": 7,
        "aug": 8, "august": 8,
        "sep": 9, "sept": 9, "september": 9,
        "oct": 10, "october": 10,
        "nov": 11, "november": 11,
        "dec": 12, "december": 12,
    }
    mth = mon_map.get(mon_name)
    if not mth:
        return None
    try:
        y = int(parts[2])
    except:
        return None
    if y < 100:
        y += 2000
    try:
        return datetime(y, mth, d, tzinfo=LOCAL_TZ)
    except:
        return None

def _month_label(y: int, m: int) -> str:
    mons = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    return f"{mons[m-1]} {y}"

def derive_filters(text: str) -> Dict:
    t = (text or "").lower()
    filt = {"category": None, "subCategory": None, "timeRange": None}
    tw = parse_time_window(t)
    if tw:
        filt["timeRange"] = tw[2]
    if "needs" in t:
        filt["category"] = "Needs"
    elif "wants" in t:
        filt["category"] = "Wants"
    elif "savings" in t or "investment" in t:
        filt["category"] = "Savings"
    if "food" in t:
        filt["subCategory"] = "Groceries"
        filt["category"] = filt["category"] or "Needs"
    elif "travel" in t:
        filt["subCategory"] = "Travel"
        filt["category"] = filt["category"] or "Wants"
    elif "rent" in t:
        filt["subCategory"] = "Rent"
        filt["category"] = filt["category"] or "Needs"
    return filt
def buildQuery(userQuery: str, userId: str) -> Optional[Dict]:
    t = (userQuery or "").lower()
    tw = parse_time_window(t)
    if not tw:
        return None
    start, end, _ = tw
    metric = None
    if "income" in t:
        metric = "income"
    elif "expense" in t or "expenses" in t:
        metric = "expenses"
    elif "saving" in t or "savings" in t or "investment" in t:
        metric = "savings"
    cat = None
    if "needs" in t:
        cat = "Needs"
    elif "wants" in t:
        cat = "Wants"
    elif "savings" in t:
        cat = "Savings"
    # Subcategory keyword mapping
    sub_kw = None
    sub_map = {
        "food": ("Needs", "Groceries"),
        "travel": ("Wants", "Travel"),
        "rent": ("Needs", "Rent"),
    }
    for k in sub_map.keys():
        if k in t:
            sub_kw = k
            break
    match: Dict = {
        "userId": ObjectId(userId),
        "date": {"$gte": start, "$lt": end},
    }
    if metric == "income":
        match["type"] = "income"
    elif metric == "expenses":
        match["type"] = "expense"
        if not cat:
            match["category"] = {"$ne": "Savings"}
    else:
        match["type"] = "expense"
        match["category"] = "Savings"
    if cat:
        match["category"] = cat
    # Resolve subCategoryId when keyword present
    if sub_kw:
        sc_cat, sc_name = sub_map[sub_kw]
        cat = cat or sc_cat
        match["category"] = cat
        sub = db.subcategories.find_one({"userId": None, "category": cat, "name": sc_name})
        if sub and sub.get("_id"):
            match["subCategoryId"] = sub["_id"]
    is_trend = ("trend" in t) or ("last" in t and "month" in t) or ("this year" in t) or re.search(r"\b\d{4}\b", t)
    is_category_breakdown = ("by category" in t) or (("needs" in t) and ("wants" in t)) or ("category breakdown" in t)
    if is_trend:
        group = {"_id": {"year": {"$year": "$date"}, "month": {"$month": "$date"}}, "total": {"$sum": "$amount"}}
        sort = {"_id.year": 1, "_id.month": 1}
        return {
            "match": match,
            "group": group,
            "sort": sort,
            "chartType": "line",
            "labels": [],
            "valueField": "total",
        }
    if is_category_breakdown or (not sub_kw and not cat and metric in ["expenses","savings"]):
        group = {"_id": "$category", "total": {"$sum": "$amount"}}
        sort = {"_id": 1}
        return {
            "match": match,
            "group": group,
            "sort": sort,
            "chartType": "pie",
            "labels": [],
            "valueField": "total",
        }
    # Fallback single total
    group = {"_id": None, "total": {"$sum": "$amount"}}
    sort = {}
    return {
        "match": match,
        "group": group,
        "sort": sort,
        "chartType": "bar",
        "labels": [],
        "valueField": "total",
    }

def context_for(user_id: str) -> Dict:
    now = datetime.now(timezone.utc)
    start, end = month_bounds(now)
    uid = ObjectId(user_id)
    tx = db.transactions
    users_col = db.users
    goals_col = db.goals
    budgets_col = db.budgets

    income = list(tx.aggregate([
        {"$match": {"userId": uid, "type": "income", "date": {"$gte": start, "$lt": end}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]))
    expense = list(tx.aggregate([
        {"$match": {"userId": uid, "type": "expense", "date": {"$gte": start, "$lt": end}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]))
    inc = float(income[0]["total"]) if income else 0.0
    exp = float(expense[0]["total"]) if expense else 0.0
    sav = inc - exp
    investable = max(0.0, sav * 0.5)

    cash = list(tx.aggregate([
        {"$match": {"userId": uid, "type": {"$in": ["income","expense"]}}},
        {"$group": {"_id": {"y": {"$year": "$date"}, "m": {"$month": "$date"}, "t": "$type"}, "total": {"$sum": "$amount"}}},
        {"$sort": {"_id.y": 1, "_id.m": 1}}
    ]))
    cash_map: Dict[str, Dict[str, float]] = {}
    for r in cash:
        key = f"{r['_id']['y']}-{str(r['_id']['m']).zfill(2)}"
        cash_map.setdefault(key, {"income": 0.0, "expense": 0.0})
        cash_map[key][r["_id"]["t"]] = float(r["total"])
    cash_series = []
    for k, v in cash_map.items():
        cash_series.append({"period": k, "income": v["income"], "expense": v["expense"], "savings": v["income"] - v["expense"]})

    month = now.month
    year = now.year
    budgets = list(budgets_col.find({"userId": uid, "month": month, "year": year}))
    rows_cat = list(tx.aggregate([
        {"$match": {"userId": uid, "type": "expense", "date": {"$gte": start, "$lt": end}}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}}}
    ]))
    spent_cat = {r["_id"]: float(r["total"]) for r in rows_cat}
    spent_sub_rows = list(tx.aggregate([
        {"$match": {"userId": uid, "type": "expense", "date": {"$gte": start, "$lt": end}}},
        {"$group": {"_id": {"category": "$category", "subCategoryId": "$subCategoryId"}, "total": {"$sum": "$amount"}}}
    ]))
    spent_sub = {f"{r['_id']['category']}:{str(r['_id']['subCategoryId'])}": float(r["total"]) for r in spent_sub_rows}
    agg = {"Needs": {"l":0.0,"s":0.0}, "Wants": {"l":0.0,"s":0.0}, "Savings": {"l":0.0,"s":0.0}}
    budget_by_cat: Dict[str, List[Dict]] = {"Needs": [], "Wants": [], "Savings": []}
    for b in budgets:
        cat = b.get("category")
        if cat in budget_by_cat:
            budget_by_cat[cat].append(b)
    for cat in ["Needs", "Wants", "Savings"]:
        rows = budget_by_cat.get(cat, [])
        parent_rows = [b for b in rows if not b.get("subCategoryId")]
        if parent_rows:
            agg[cat]["l"] = sum(float(b.get("limit", 0) or 0) for b in parent_rows)
            agg[cat]["s"] = float(spent_cat.get(cat, 0) or 0)
            continue
        agg[cat]["l"] = sum(float(b.get("limit", 0) or 0) for b in rows)
        agg[cat]["s"] = sum(
            float(spent_sub.get(f"{cat}:{str(b.get('subCategoryId'))}", 0) or 0)
            for b in rows
            if b.get("subCategoryId")
        )
    overspent = [k for k,v in agg.items() if v["s"] > v["l"]]

    goals = list(goals_col.find({"userId": uid}))
    sub_ids = [g.get("linkedSubCategoryId") for g in goals if g.get("linkedSubCategoryId")]
    prog_map = {}
    month_map = {}
    if sub_ids:
        total_rows = list(tx.aggregate([
            {"$match": {"userId": uid, "type": "expense", "category": "Savings", "subCategoryId": {"$in": sub_ids}}},
            {"$group": {"_id": "$subCategoryId", "total": {"$sum": "$amount"}}}
        ]))
        for r in total_rows:
            prog_map[str(r["_id"])] = float(r["total"])
        month_rows = list(tx.aggregate([
            {"$match": {"userId": uid, "type": "expense", "category": "Savings", "subCategoryId": {"$in": sub_ids}, "date": {"$gte": start, "$lt": end}}},
            {"$group": {"_id": "$subCategoryId", "total": {"$sum": "$amount"}}}
        ]))
        for r in month_rows:
            month_map[str(r["_id"])] = float(r["total"])
    goal_items = []
    for g in goals:
        targ = float(g.get("targetAmount", 0))
        sub_id = str(g.get("linkedSubCategoryId")) if g.get("linkedSubCategoryId") else None
        prog = prog_map.get(sub_id, 0.0)
        pct = min(100.0, (prog / targ) * 100.0) if targ > 0 else 0.0
        plan = float(g.get("monthlyContribution", 0))
        actual = month_map.get(sub_id, 0.0)
        status = "On Track" if plan > 0 and actual >= plan else "Behind" if plan > 0 else ""
        goal_items.append({"name": g.get("name"), "progressPct": round(pct, 1), "plan": plan, "actual": actual, "status": status})

    # Recommendation fallback from profile
    reco_investable = 0.0
    reco_allocations: Dict[str, float] = {}
    user = users_col.find_one({"_id": uid}) or {}
    profile = user.get("profile") or {}
    monthly_income = float(profile.get("monthlyIncome") or 0.0)
    age = int(profile.get("age") or 0)
    risk = profile.get("riskProfile") or "Moderate"
    if monthly_income > 0:
        split = smart_salary_split(monthly_income)
        reco_investable = monthly_income * split["Savings"]
        weights = risk_allocation(risk, age)
        raw_alloc = {k: round(reco_investable * w, 2) for k, w in weights.items()}
        capped = apply_tax_caps(raw_alloc)
        reco_allocations = capped

    return {
        "month": month,
        "year": year,
        "summary": {"income": inc, "expense": exp, "savings": sav, "investable": investable},
        "cashflow": cash_series[-6:],  # last 6 points
        "budgetsAgg": agg,
        "overspent": overspent,
        "goals": goal_items,
        "reco_investable": reco_investable,
        "reco_allocations": reco_allocations,
        "profile": {
            "monthlyIncome": monthly_income,
            "age": age,
            "riskProfile": risk
        }
    }


def llm_reply(message: str, context: Dict) -> Optional[Dict]:
    try:
        body = {
            "model": OLLAMA_MODEL,
            "prompt": f"{POCKETWISE_CODEX_PROMPT}\n\nContext:\n{context}\n\nUser Query: {message}\n\nReturn ONLY the JSON object:",
            "stream": False,
            "format": "json"
        }
        r = requests.post(f"{OLLAMA_URL}/api/generate", json=body, timeout=10)
        if r.ok:
            import json
            data = r.json()
            raw_res = data.get("response", "{}")
            res = json.loads(raw_res)
            # Normalize to strict shape if the LLM produced a different schema
            if isinstance(res, dict) and ("data" in res and "explanation" in res and "recommendation" in res):
                return res
            norm = {
                "data": res.get("data", {}) if isinstance(res, dict) else {},
                "chart": res.get("chart", {}) if isinstance(res, dict) else {},
                "explanation": "",
                "recommendation": ""
            }
            if isinstance(res, dict):
                norm["explanation"] = res.get("explanation") or res.get("message", "") or ""
                recs = res.get("recommendation") or res.get("recommendations")
                if isinstance(recs, list):
                    norm["recommendation"] = "; ".join([str(x) for x in recs if x])
                elif isinstance(recs, str):
                    norm["recommendation"] = recs
            # Final guard for missing data scenario
            if context["summary"]["income"] == 0 and context["summary"]["expense"] == 0 and ("income" in norm["data"] or "expenses" in norm["data"] or "savings" in norm["data"]):
                return {"data": {}, "chart": {}, "explanation": "Data not available for this request. Please add transactions.", "recommendation": ""}
            return norm
        return None
    except Exception as e:
        print(f"LLM Error: {e}")
        return None

def llm_followup(topic: str, prev: Dict, context: Dict, depth: int) -> Optional[Dict]:
    try:
        sys = (
            "You are a senior fintech assistant. Provide a deeper explanation and 1–2 practical recommendations based on the prior answer.\n"
            "Do not change numbers or data. Do not introduce new data. Do not include any missing-data messages.\n"
            "Make the explanation richer than the original. Use depth level to increase detail.\n"
            "Return ONLY JSON: {\"explanation\":\"\", \"recommendation\":\"\"}."
        )
        body = {
            "model": OLLAMA_MODEL,
            "prompt": f"{sys}\n\nTopic: {topic}\nDepthLevel: {depth}\nPrior Answer JSON:\n{prev}\n\nReturn the JSON:",
            "stream": False,
            "format": "json"
        }
        r = requests.post(f"{OLLAMA_URL}/api/generate", json=body, timeout=10)
        if r.ok:
            import json
            data = r.json()
            raw_res = data.get("response", "{}")
            res = json.loads(raw_res)
            out = {
                "explanation": res.get("explanation", ""),
                "recommendation": res.get("recommendation", "")
            }
            return out
        return None
    except Exception as e:
        print(f"LLM Followup Error: {e}")
        return None

def llm_concept_reply(message: str) -> Optional[Dict]:
    try:
        sys = (
            "You are a fintech educator assistant for PocketWise.\n"
            "Answer general finance concept questions clearly and practically.\n"
            "Do NOT ask for transactions for concept questions.\n"
            "Return ONLY strict JSON: {\"data\": {}, \"chart\": {}, \"explanation\": \"\", \"recommendation\": \"\"}."
        )
        body = {
            "model": OLLAMA_MODEL,
            "prompt": f"{sys}\n\nUser Question: {message}\n\nReturn the JSON:",
            "stream": False,
            "format": "json"
        }
        r = requests.post(f"{OLLAMA_URL}/api/generate", json=body, timeout=10)
        if r.ok:
            import json
            data = r.json()
            raw_res = data.get("response", "{}")
            res = json.loads(raw_res)
            if isinstance(res, dict):
                return {
                    "data": res.get("data", {}) if isinstance(res.get("data", {}), dict) else {},
                    "chart": res.get("chart", {}) if isinstance(res.get("chart", {}), dict) else {},
                    "explanation": str(res.get("explanation", "") or ""),
                    "recommendation": str(res.get("recommendation", "") or "")
                }
        return None
    except Exception as e:
        print(f"LLM Concept Error: {e}")
        return None

def detect_concept_key(text: str, topic_hint: str = "") -> str:
    t = f"{text or ''} {topic_hint or ''}".lower()
    if "sip" in t or "systematic investment plan" in t:
        return "sip"
    if "ppf" in t or "public provident fund" in t:
        return "ppf"
    if "elss" in t or "equity linked savings scheme" in t:
        return "elss"
    if "nps" in t or "national pension system" in t:
        return "nps"
    if "tax" in t or "80c" in t or "80d" in t or "80ccd" in t:
        return "tax"
    return ""

def concept_fallback_payload(concept: str, detailed: bool) -> Dict:
    if concept == "sip":
        topic = "Systematic Investment Plan SIP"
        explanation = (
            "SIP means investing a fixed amount in a mutual fund at regular intervals, usually monthly. "
            "It helps build wealth through disciplined investing and rupee-cost averaging."
        )
        if detailed:
            explanation = (
                "SIP (Systematic Investment Plan) is a method where you invest a fixed amount periodically into a mutual fund.\n"
                "It reduces timing risk because you buy more units when markets are low and fewer when markets are high.\n"
                "Over long periods, SIP supports compounding and makes investing habit-based instead of emotion-based."
            )
        recommendation = "Start with an amount you can sustain every month and increase it annually with income growth."
        return {"topic": topic, "explanation": explanation, "recommendation": recommendation}
    if concept == "ppf":
        topic = "Public Provident Fund PPF"
        explanation = (
            "PPF is a long-term government-backed savings scheme with tax benefits and relatively stable returns."
        )
        if detailed:
            explanation = (
                "PPF is a long-tenure savings product backed by the Government of India.\n"
                "It offers tax benefits under Section 80C, tax-free interest, and tax-free maturity.\n"
                "It works best for conservative long-term goals and retirement planning."
            )
        recommendation = "Use PPF as the stable debt component of your long-term portfolio."
        return {"topic": topic, "explanation": explanation, "recommendation": recommendation}
    if concept == "elss":
        topic = "Equity Linked Savings Scheme ELSS"
        explanation = (
            "ELSS is a tax-saving mutual fund under Section 80C with a 3-year lock-in and equity market exposure."
        )
        if detailed:
            explanation = (
                "ELSS is an equity-oriented mutual fund that provides tax deduction under Section 80C.\n"
                "It has the shortest lock-in among 80C products at 3 years.\n"
                "Returns are market-linked, so it is suitable for investors comfortable with volatility."
            )
        recommendation = "Choose diversified ELSS funds and align them with a goal horizon above 5 years."
        return {"topic": topic, "explanation": explanation, "recommendation": recommendation}
    if concept == "nps":
        topic = "National Pension System NPS"
        explanation = (
            "NPS is a retirement-focused investment scheme with equity and debt allocation and additional tax benefits."
        )
        if detailed:
            explanation = (
                "NPS is designed for retirement and invests across equity, corporate debt, and government securities.\n"
                "It offers tax benefits under Sections 80C and an additional 80CCD(1B).\n"
                "It is useful for long-term retirement accumulation with disciplined contributions."
            )
        recommendation = "Use NPS for retirement goals and review your equity allocation based on age and risk profile."
        return {"topic": topic, "explanation": explanation, "recommendation": recommendation}
    topic = "Tax Saving Basics"
    explanation = (
        "Tax planning means legally reducing tax liability by using deductions and suitable investment choices."
    )
    if detailed:
        explanation = (
            "Tax planning is the process of structuring income, expenses, and investments to reduce tax legally.\n"
            "Common sections include 80C, 80D, and 80CCD(1B), each with different limits and eligible products.\n"
            "Good tax planning balances tax benefit with liquidity, risk, and long-term goals."
        )
    recommendation = "Prioritize deductions that match your goals instead of investing only for tax-saving."
    return {"topic": topic, "explanation": explanation, "recommendation": recommendation}

@app.post("/chat")
async def chat(req: ChatRequest):
    t = (req.message or "").lower()
    uid = ObjectId(req.userId)
    ctx = context_for(req.userId)
    fstate = derive_filters(t)
    sess = sessions.setdefault(str(uid), {})

    if is_followup(t) and sess.get("last_payload"):
        prev = sess.get("last_payload") or {}
        last_intent = sess.get("last_intent","")
        last_topic = sess.get("last_topic","previous answer")
        d = int(sess.get("detail_depth") or 0) + 1
        sess["detail_depth"] = d
        topic_auto = llm_generate_topic(prev, last_topic)
        llm_res = llm_followup(topic_auto, prev, ctx, d)
        if llm_res:
            out = {
                "data": prev.get("data", {}),
                "chart": prev.get("chart", {}),
                "chartMeta": prev.get("chartMeta", {}),
                "filters": prev.get("filters", {}),
                "insight": prev.get("insight", {}),
                "explanation": llm_res.get("explanation", ""),
                "recommendation": llm_res.get("recommendation", "")
            }
            return _respond(str(uid), topic_auto, last_intent or "follow-up", out)
        if last_intent == "concept":
            concept = detect_concept_key(last_topic, prev.get("explanation", ""))
            if concept:
                fb = concept_fallback_payload(concept, True)
                out = {
                    "data": prev.get("data", {}),
                    "chart": prev.get("chart", {}),
                    "chartMeta": prev.get("chartMeta", {}),
                    "filters": prev.get("filters", {}),
                    "insight": prev.get("insight", {}),
                    "explanation": fb.get("explanation", ""),
                    "recommendation": fb.get("recommendation", "")
                }
                return _respond(str(uid), fb.get("topic", topic_auto), "concept", out)
        out = {
            "data": prev.get("data", {}),
            "chart": prev.get("chart", {}),
            "chartMeta": prev.get("chartMeta", {}),
            "filters": prev.get("filters", {}),
            "insight": prev.get("insight", {}),
            "explanation": prev.get("explanation", ""),
            "recommendation": prev.get("recommendation", "")
        }
        return _respond(str(uid), topic_auto, last_intent or "follow-up", out)
    
    # Total income (current month) - skip when asking for last N months
    if (any(kw in t for kw in ["total income", "income this month", "monthly income (actual)", "actual income this month"]) or (("income" in t) and ("total" in t or "this month" in t))) and not re.search(r"last\s+\d+\s*months?", t):
        inc = ctx["summary"]["income"]
        if inc == 0:
            return {"data": {}, "explanation": "Data not available for this request. Please add transactions.", "recommendation": ""}
        return _respond(str(uid), "income this month", "summary", {
            "data": {"income": int(round(inc))},
            "chart": {"type": "bar", "labels": ["Income"], "values": [int(round(inc))]},
            "chartMeta": {"metric": "income", "unit": "₹", "aggregation": "total"},
            "filters": {**fstate, "timeRange": fstate.get("timeRange") or "this month"},
            "insight": {},
            "explanation": "Recorded income for this month.",
            "recommendation": "Verify all salary/bonus entries are captured."
        })
    
    # Total expenses (current month) - skip when asking for last N months
    if (any(kw in t for kw in ["total expense", "total expenses", "expenses this month", "monthly expenses"]) or (("expense" in t or "expenses" in t) and ("total" in t or "this month" in t))) and not re.search(r"last\s+\d+\s*months?", t):
        exp = ctx["summary"]["expense"]
        if exp == 0:
            return {"data": {}, "explanation": "Data not available for this request. Please add transactions.", "recommendation": ""}
        return _respond(str(uid), "expenses this month", "summary", {
            "data": {"expenses": int(round(exp))},
            "chart": {"type": "bar", "labels": ["Expenses"], "values": [int(round(exp))]},
            "chartMeta": {"metric": "expenses", "unit": "₹", "aggregation": "total"},
            "filters": {**fstate, "timeRange": fstate.get("timeRange") or "this month"},
            "insight": {},
            "explanation": "Recorded expenses for this month.",
            "recommendation": "Track receipts to avoid under-reporting."
        })
    
    # Total metric over last N months (sum) - income | expenses | savings
    if "total" in t and "last" in t and "month" in t:
        m_total = re.search(r"last\s+(\d+)\s*months?", t)
        n = int(m_total.group(1)) if m_total else 3
        n = max(1, min(n, 12))
        metric = None
        if "income" in t:
            metric = "income"
        elif "expense" in t or "expenses" in t:
            metric = "expenses"
        elif "saving" in t or "savings" in t:
            metric = "savings"
        if metric:
            base = datetime(datetime.now(timezone.utc).year, datetime.now(timezone.utc).month, 1, tzinfo=timezone.utc)
            start = add_months(base, -n)
            end = add_months(base, 1)
            match_cond = {"userId": uid, "date": {"$gte": start, "$lt": end}}
            if metric == "income":
                match_cond["type"] = "income"
            elif metric == "expenses":
                match_cond["type"] = "expense"
                match_cond["category"] = {"$ne": "Savings"}
            else:  # savings
                match_cond["type"] = "expense"
                match_cond["category"] = "Savings"
            rows = list(db.transactions.aggregate([
                {"$match": match_cond},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]))
            if not rows:
                return {"data": {}, "explanation": "Data not available for this request. Please add transactions.", "recommendation": ""}
            total_val = int(round(float(rows[0].get("total", 0))))
            label = "income" if metric == "income" else ("expenses" if metric == "expenses" else "savings")
            return _respond(str(uid), f"total {label} last {n} months", "total", {
                "data": {f"total{label.capitalize()}": total_val, "months": n},
                "chart": {"type": "bar", "labels": [label], "values": [total_val]},
                "chartMeta": {"metric": label, "unit": "₹", "aggregation": "total"},
                "filters": {**fstate, "timeRange": f"last {n} months"},
                "insight": {},
                "explanation": f"Sum of recorded {label} over the last {n} months.",
                "recommendation": "Investigate outliers if the total looks unusual."
            })
    
    # Spending by category (Needs/Wants/Savings) this month
    if ("spending" in t or "spent" in t) and any(c in t for c in ["needs", "wants", "savings"]):
        agg = ctx.get("budgetsAgg") or {}
        has_any = any((agg.get(cat, {}).get("s", 0) or 0) > 0 for cat in ["Needs", "Wants", "Savings"])
        if not has_any and (ctx["summary"]["income"] == 0 and ctx["summary"]["expense"] == 0):
            return {"data": {}, "explanation": "Data not available for this request. Please add transactions.", "recommendation": ""}
        out = {}
        if "needs" in t:
            out["needsSpent"] = int(round((agg.get("Needs") or {}).get("s", 0)))
        if "wants" in t:
            out["wantsSpent"] = int(round((agg.get("Wants") or {}).get("s", 0)))
        if "savings" in t:
            out["savingsSpent"] = int(round((agg.get("Savings") or {}).get("s", 0)))
        labels = []
        values = []
        if "needsSpent" in out:
            labels.append("Needs"); values.append(out["needsSpent"])
        if "wantsSpent" in out:
            labels.append("Wants"); values.append(out["wantsSpent"])
        if "savingsSpent" in out:
            labels.append("Savings"); values.append(out["savingsSpent"])
        return _respond(str(uid), "category spending this month", "category", {
            "data": out,
            "chart": {"type": "pie", "labels": labels[:5] + (["Others"] if len(labels) > 5 else []), "values": values[:5] + ([sum(values[5:])] if len(values) > 5 else [])} if labels and values else {},
            "chartMeta": {"metric": "expenses", "unit": "₹", "aggregation": "category"},
            "filters": {**fstate, "timeRange": fstate.get("timeRange") or "this month"},
            "insight": {},
            "drilldown": {"enabled": True, "nextLevel": "subCategory"},
            "explanation": "Current-month category spending.",
            "recommendation": "Rebalance Wants if spending exceeds plan."
        })
    
    # Budget limit for category (Needs/Wants/Savings)
    if ("budget" in t) and any(c in t for c in ["needs", "wants", "savings"]) and any(k in t for k in ["limit", "budget", "cap"]):
        agg = ctx.get("budgetsAgg") or {}
        has_budgets = any((agg.get(cat, {}).get("l", 0) or 0) > 0 for cat in ["Needs", "Wants", "Savings"])
        if not has_budgets:
            return {"data": {}, "explanation": "Data not available for this request. Please add transactions.", "recommendation": ""}
        out = {}
        if "needs" in t:
            out["needsLimit"] = int(round((agg.get("Needs") or {}).get("l", 0)))
        if "wants" in t:
            out["wantsLimit"] = int(round((agg.get("Wants") or {}).get("l", 0)))
        if "savings" in t:
            out["savingsLimit"] = int(round((agg.get("Savings") or {}).get("l", 0)))
        labels = []
        values = []
        if "needsLimit" in out:
            labels.append("Needs"); values.append(out["needsLimit"])
        if "wantsLimit" in out:
            labels.append("Wants"); values.append(out["wantsLimit"])
        if "savingsLimit" in out:
            labels.append("Savings"); values.append(out["savingsLimit"])
        return _respond(str(uid), "budget limits this month", "category", {
            "data": out,
            "chart": {"type": "bar", "labels": labels, "values": values} if labels and values else {},
            "chartMeta": {"metric": "expenses", "unit": "₹", "aggregation": "category"},
            "filters": {**fstate, "timeRange": fstate.get("timeRange") or "this month"},
            "insight": {},
            "explanation": "Active budgets for this month.",
            "recommendation": "Keep discretionary within limits to protect savings."
        })
    
    # Investments this month (actual) - from Savings category spend
    if ("investment" in t or "investments" in t) and any(k in t for k in ["total", "this month", "actual"]):
        agg = ctx.get("budgetsAgg") or {}
        # If there are truly no transactions, return missing
        if (ctx["summary"]["income"] == 0 and ctx["summary"]["expense"] == 0):
            return {"data": {}, "explanation": "Data not available for this request. Please add transactions.", "recommendation": ""}
        invest = int(round((agg.get("Savings") or {}).get("s", 0)))
        return _respond(str(uid), "investments this month", "summary", {
            "data": {"investments": invest},
            "chart": {"type": "bar", "labels": ["Investments"], "values": [invest]},
            "chartMeta": {"metric": "savings", "unit": "₹", "aggregation": "total"},
            "filters": {**fstate, "timeRange": fstate.get("timeRange") or "this month"},
            "insight": {},
            "explanation": "Actual investments counted from Savings category this month.",
            "recommendation": "Automate SIPs to stay on track."
        })
    
    # Goals progress list (top 5)
    if ("goals" in t) and ("progress" in t or "list" in t or "status" in t):
        items = ctx.get("goals") or []
        if not items:
            return {"data": {}, "explanation": "Data not available for this request. Please add transactions.", "recommendation": ""}
        out = []
        for g in items[:5]:
            out.append({
                "name": g.get("name"),
                "progressPct": g.get("progressPct"),
                "plan": int(round(g.get("plan", 0))),
                "actual": int(round(g.get("actual", 0))),
                "status": g.get("status") or ""
            })
        chart_labels = [x.get("name") for x in out if x.get("name") is not None]
        chart_values = [x.get("progressPct") for x in out if x.get("progressPct") is not None]
        return _respond(str(uid), "goals progress", "comparison", {
            "data": {"goals": out},
            "chart": {"type": "bar", "labels": chart_labels, "values": chart_values} if chart_labels and chart_values else {},
            "chartMeta": {"metric": "savings", "unit": "₹", "aggregation": "comparison"},
            "filters": fstate,
            "insight": {},
            "explanation": "Top goals with current progress.",
            "recommendation": "Increase contributions for goals marked Behind."
        })
    
    # Total savings (net = income - expenses) for current month
    if any(k in t for k in ["total saving", "total savings", "savings total", "net savings", "total save"]):
        inc = ctx["summary"]["income"]
        exp = ctx["summary"]["expense"]
        if (inc == 0 and exp == 0):
            return {"data": {}, "explanation": "Data not available for this request. Please add transactions.", "recommendation": ""}
        sav = int(round(ctx["summary"]["savings"]))
        return _respond(str(uid), "savings this month", "summary", {
            "data": { "savings": sav },
            "chart": {"type": "bar", "labels": ["Savings"], "values": [sav]},
            "chartMeta": {"metric": "savings", "unit": "₹", "aggregation": "total"},
            "filters": {**fstate, "timeRange": fstate.get("timeRange") or "this month"},
            "insight": {},
            "explanation": "Net savings for this month (income minus expenses).",
            "recommendation": "Direct part of the surplus into your priority goals."
        })
    
    if (("latest" in t or "lastest" in t or "last" in t or "recent" in t or "late" in t)) and ("transaction" in t or "transcation" in t or "transactions" in t):
        txc = db.transactions
        now = datetime.now(timezone.utc)
        doc = None
        if "this month" in t:
            start, end = month_bounds(now)
            doc = txc.find_one({"userId": uid, "date": {"$gte": start, "$lt": end}}, sort=[("date", -1), ("_id", -1)])
        if not doc:
            doc = txc.find_one({"userId": uid}, sort=[("date", -1), ("_id", -1)])
        if not doc:
            return {"data": {}, "explanation": "Data not available for this request. Please add transactions.", "recommendation": ""}
        amt = int(round(float(doc.get("amount", 0) or 0)))
        typ = str(doc.get("type") or "")
        cat = str(doc.get("category") or "")
        dt = doc.get("date") or datetime.now(timezone.utc)
        return _respond(str(uid), "latest transaction", "latest", {
            "data": {
                "amount": amt,
                "type": typ,
                "category": cat,
                "date": dt.isoformat()
            },
            "chart": {},
            "chartMeta": {"metric": "income" if typ == "income" else "expenses", "unit": "₹", "aggregation": "total"},
            "filters": fstate,
            "insight": {},
            "explanation": "Most recent transaction.",
            "recommendation": "Review and re-categorize if necessary."
        })
    
    # Deterministic handling for "Plan my budget" using profile only (allowed)
    if ("plan my budget" in t) or ("plan budget" in t) or ("budget planning" in t) or ("budget" in t and "plan" in t):
        prof = ctx.get("profile") or {}
        inc = float(prof.get("monthlyIncome") or 0)
        risk = (prof.get("riskProfile") or "Moderate")
        if inc <= 0:
            return {"data": {}, "explanation": "Data not available for this request. Please add transactions.", "recommendation": ""}
        if risk == "Conservative":
            split = {"Needs": 0.55, "Wants": 0.20, "Savings": 0.25}
        elif risk == "Aggressive":
            split = {"Needs": 0.40, "Wants": 0.20, "Savings": 0.40}
        else:
            split = {"Needs": 0.45, "Wants": 0.25, "Savings": 0.30}
        n_val = int(round(inc * split["Needs"]))
        w_val = int(round(inc * split["Wants"]))
        s_val = int(round(inc * split["Savings"]))
        return _respond(str(uid), "plan my budget", "planning", {
            "data": {
                "income": int(round(inc)),
                "needs": n_val,
                "wants": w_val,
                "savings": s_val
            },
            "chart": {"type": "pie", "labels": ["Needs","Wants","Savings"], "values": [n_val, w_val, s_val]},
            "chartMeta": {"metric": "income", "unit": "₹", "aggregation": "comparison"},
            "filters": fstate,
            "insight": {},
            "explanation": "Based on your income and risk profile.",
            "recommendation": f"Allocate {int(split['Needs']*100)}% needs, {int(split['Wants']*100)}% wants, {int(split['Savings']*100)}% savings."
        })
    
    # Quick deterministic handling for budget remaining (uses budgets even if transactions are absent)
    if ("remaining" in t and "budget" in t) or ("budget" in t and "left" in t):
        agg = ctx.get("budgetsAgg") or {}
        has_budgets = any((agg.get(cat, {}).get("l", 0) or 0) > 0 for cat in ["Needs", "Wants", "Savings"])
        if not has_budgets:
            return {"data": {}, "explanation": "Data not available for this request. Please add transactions.", "recommendation": ""}
        needs_r = max(0, int(round((agg.get("Needs") or {}).get("l", 0) - (agg.get("Needs") or {}).get("s", 0))))
        wants_r = max(0, int(round((agg.get("Wants") or {}).get("l", 0) - (agg.get("Wants") or {}).get("s", 0))))
        savings_r = max(0, int(round((agg.get("Savings") or {}).get("l", 0) - (agg.get("Savings") or {}).get("s", 0))))
        total_r = needs_r + wants_r + savings_r
        return _respond(str(uid), "budget remaining", "comparison", {
            "data": {
                "needsRemaining": needs_r,
                "wantsRemaining": wants_r,
                "savingsRemaining": savings_r,
                "totalRemaining": total_r
            },
            "chart": {"type": "bar", "labels": ["Needs","Wants","Savings"], "values": [needs_r, wants_r, savings_r]},
            "chartMeta": {"metric": "expenses", "unit": "₹", "aggregation": "comparison"},
            "filters": fstate,
            "insight": {},
            "explanation": "Calculated from current-month budgets and spend.",
            "recommendation": "Channel unspent Wants towards Savings to strengthen reserves."
        })
    
    # Query Builder execution (Mongo) for flexible data queries (skip when deterministic cashflow/summary keywords present)
    qb = buildQuery(t, req.userId)
    if qb and not any(k in t for k in ["cash flow", "cashflow", "status", "summary"]):
        pipe = [{"$match": qb["match"]}, {"$group": qb["group"]}]
        if qb.get("sort"):
            pipe.append({"$sort": qb["sort"]})
        rows = list(db.transactions.aggregate(pipe))
        if not rows:
            return {"data": {}, "chart": {}, "explanation": "No data available for selected range.", "recommendation": "Try selecting a different time range."}
        labels = []
        values = []
        if "year" in (qb["group"]["_id"] if isinstance(qb["group"]["_id"], dict) else {}):
            for r in rows:
                y = int(r["_id"]["year"])
                m = int(r["_id"]["month"])
                labels.append(_month_label(y, m))
                values.append(int(round(float(r.get(qb["valueField"], 0)))))
        elif qb["group"]["_id"] == "$category":
            for r in rows:
                labels.append(str(r["_id"]))
                values.append(int(round(float(r.get(qb["valueField"], 0)))))
        else:
            labels = ["total"]
            values = [int(round(float(rows[0].get(qb["valueField"], 0))))]
        data = {"labels": labels, "values": values}
        # Category top-5 aggregation into "Others"
        if qb["group"].get("_id") == "$category" and len(labels) > 5:
            pairs = list(zip(labels, values))
            pairs.sort(key=lambda x: x[1], reverse=True)
            top = pairs[:5]
            others_total = sum(v for _, v in pairs[5:])
            labels = [x for x, _ in top] + (["Others"] if others_total > 0 else [])
            values = [v for _, v in top] + ([others_total] if others_total > 0 else [])
            data = {"labels": labels, "values": values}
        chart = {"type": ("line" if "year" in (qb["group"]["_id"] if isinstance(qb["group"]["_id"], dict) else {}) else ("pie" if qb["group"].get("_id") == "$category" else "bar")), "labels": labels, "values": values}
        metric_meta = "income" if qb["match"].get("type") == "income" else ("savings" if qb["match"].get("category") == "Savings" else "expenses")
        agg_meta = "monthly" if "year" in (qb["group"]["_id"] if isinstance(qb["group"]["_id"], dict) else {}) else ("category" if qb["group"].get("_id") == "$category" else "total")
        insight = {}
        if agg_meta == "monthly" and len(values) >= 2:
            prev = float(values[-2] or 0)
            curr = float(values[-1] or 0)
            pct = ((curr - prev) / prev * 100.0) if prev > 0 else 0.0
            sign = "+" if pct > 0 else "-" if pct < 0 else ""
            insight = {"changePct": f"{sign}{abs(pct):.1f}%", "trend": "increase" if pct > 0 else "decrease" if pct < 0 else "flat"}
        filters_out = {"category": fstate.get("category"), "subCategory": fstate.get("subCategory"), "timeRange": fstate.get("timeRange")}
        return {
            "data": data,
            "chart": chart,
            "chartMeta": {"metric": metric_meta, "unit": "₹", "aggregation": agg_meta},
            "filters": filters_out,
            "insight": insight,
            "explanation": "",
            "recommendation": ""
        }
    
    # Trend queries: "<metric> trend last N months" (metric = income|expenses|savings)
    if "trend" in t and "last" in t and "month" in t:
        mnum = re.search(r"last\s+(\d+)\s*months?", t)
        n = int(mnum.group(1)) if mnum else 3
        n = max(1, min(n, 12))
        # Determine metric and build precise Mongo pipeline to avoid mixing Savings into expenses
        metric = "income"
        if "expense" in t or "expenses" in t:
            metric = "expenses"
        elif "saving" in t or "savings" in t:
            metric = "savings"
        base = datetime(datetime.now(timezone.utc).year, datetime.now(timezone.utc).month, 1, tzinfo=timezone.utc)
        start = add_months(base, -n)
        end = add_months(base, 1)
        match_cond = {"userId": uid, "date": {"$gte": start, "$lt": end}}
        if metric == "income":
            match_cond["type"] = "income"
        elif metric == "expenses":
            match_cond["type"] = "expense"
            match_cond["category"] = {"$ne": "Savings"}  # exclude Savings from expenses
        else:  # savings
            match_cond["type"] = "expense"
            match_cond["category"] = "Savings"
        rows = list(db.transactions.aggregate([
            {"$match": match_cond},
            {"$group": {"_id": {"y": {"$year": "$date"}, "m": {"$month": "$date"}}, "total": {"$sum": "$amount"}}},
            {"$sort": {"_id.y": 1, "_id.m": 1}}
        ]))
        if not rows:
            return {"data": {}, "explanation": "Data not available for this request. Please add transactions.", "recommendation": ""}
        months = [f"{r['_id']['y']}-{str(r['_id']['m']).zfill(2)}" for r in rows]
        values = [int(round(float(r.get("total", 0)))) for r in rows]
        mon_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        labels = []
        for r in rows:
            y = int(r["_id"]["y"])
            m = int(r["_id"]["m"])
            labels.append(f"{mon_names[m-1]} {y}")
        change_pct_str = ""
        trend_dir = ""
        if len(values) >= 2:
            prev = float(values[-2] or 0)
            curr = float(values[-1] or 0)
            pct = ((curr - prev) / prev * 100.0) if prev > 0 else 0.0
            sign = "+" if pct > 0 else "-" if pct < 0 else ""
            change_pct_str = f"{sign}{abs(pct):.1f}%"
            trend_dir = "increase" if pct > 0 else "decrease" if pct < 0 else "flat"
        return _respond(str(uid), f"{metric} trend", "trend", {
            "data": {
                "months": months,
                metric: values
            },
            "chart": {"type": "line", "labels": labels, "values": values},
            "chartMeta": {"metric": metric, "unit": "₹", "aggregation": "monthly"},
            "filters": fstate,
            "insight": {"changePct": change_pct_str, "trend": trend_dir} if change_pct_str else {},
            "explanation": f"{metric.capitalize()} trend for the last {len(months)} months.",
            "recommendation": "Maintain consistency; smooth spikes via budgeting."
        })
    
    # Check if we have basic transaction data for data-heavy requests
    has_tx = ctx["summary"]["income"] > 0 or ctx["summary"]["expense"] > 0
    
    # Prioritize LLM
    llm_res = llm_reply(req.message, ctx)
    if llm_res and isinstance(llm_res, dict) and "message" in llm_res:
        return llm_res

    # Rule-based Fallback with STRICT data validation
    response = {
        "message": "Data not available for this request. Please add transactions to get accurate insights.",
        "insights": [],
        "recommendations": [],
        "action": None
    }

    # If no transactions and it's a data-heavy summary query, return immediately
    if not has_tx and any(k in t for k in ["how am i doing", "status", "summary"]):
        return response

    # Overspending / spending queries should still use budgets if present
    if any(k in t for k in ["overspending", "spending", "waste", "wasting", "overspent"]):
        agg = ctx.get("budgetsAgg") or {}
        has_budgets = any((agg.get(cat, {}).get("l", 0) or 0) > 0 for cat in ["Needs", "Wants", "Savings"])
        if not has_budgets and not has_tx:
            return {"data": {}, "explanation": "Data not available for this request. Please add transactions.", "recommendation": ""}
        overs = ctx.get("overspent") or []
        if overs:
            items = []
            for cat in overs:
                lmt = int(round((agg.get(cat) or {}).get("l", 0)))
                spn = int(round((agg.get(cat) or {}).get("s", 0)))
                items.append({"category": cat, "budget": lmt, "spent": spn})
            return _respond(str(uid), "overspent categories", "category", {
                "data": {"overspent": items},
                    "chart": {"type": "bar", "labels": [x["category"] for x in items], "values": [x["spent"] for x in items]},
                    "chartMeta": {"metric": "expenses", "unit": "₹", "aggregation": "category"},
                    "filters": fstate,
                    "insight": {},
                    "drilldown": {"enabled": True, "nextLevel": "subCategory"},
                "explanation": "These categories exceeded their monthly limits.",
                "recommendation": "Pause non-essential expenses in overspent categories."
            })
        else:
                return _respond(str(uid), "overspent categories", "category", {"data": {}, "chart": {}, "chartMeta": {"metric": "expenses", "unit": "₹", "aggregation": "category"}, "filters": fstate, "insight": {}, "explanation": "No categories overspent.", "recommendation": "Maintain current spending discipline."})

    # A) COMPLETE FINANCIAL PLAN
    if any(k in t for k in ["financial plan", "budget plan", "money management", "savings strategy", "planning"]):
        inc = ctx["profile"]["monthlyIncome"]
        if inc <= 0:
            return response
            
        risk = ctx["profile"]["riskProfile"]
        split = smart_salary_split(inc)
        n_val, w_val, s_val = inc * split["Needs"], inc * split["Wants"], inc * split["Savings"]
        
        return {
            "data": {
                "income": int(round(inc)),
                "needs": int(round(n_val)),
                "wants": int(round(w_val)),
                "savings": int(round(s_val)),
            },
            "explanation": "Based on your income and risk profile.",
            "recommendation": f"Allocate {int(split['Needs']*100)}% needs, {int(split['Wants']*100)}% wants, {int(split['Savings']*100)}% savings."
        }

    # B) CASH FLOW SUMMARY (data required) with time-range support
    if any(k in t for k in ["cash flow", "cashflow", "how am i doing", "status", "summary"]):
        if not has_tx:
            return {
                "data": {},
                "chart": {},
                "chartMeta": {"metric": "savings", "unit": "₹", "aggregation": "comparison"},
                "filters": fstate,
                "insight": {},
                "explanation": "Data not available for this request. Please add transactions.",
                "recommendation": ""
            }
        now = datetime.now(timezone.utc)
        tw = parse_time_window(t)
        if tw:
            start, end, label = tw
        else:
            start, end = month_bounds(now)
            label = "this month"
        rows = list(db.transactions.aggregate([
            {"$match": {"userId": uid, "type": {"$in": ["income","expense"]}, "date": {"$gte": start, "$lt": end}}},
            {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}}
        ]))
        inc = 0.0
        exp = 0.0
        for r in rows:
            if r["_id"] == "income":
                inc = float(r["total"])
            elif r["_id"] == "expense":
                exp = float(r["total"])
        sav = inc - exp
        rate = (sav / inc * 100) if inc > 0 else 0
        return _respond(str(uid), "cashflow summary", "comparison", {
            "data": {
                "income": int(round(inc)),
                "expenses": int(round(exp)),
                "savings": int(round(sav))
            },
            "chart": {"type": "bar", "labels": ["income","expenses","savings"], "values": [int(round(inc)), int(round(exp)), int(round(sav))]},
            "chartMeta": {"metric": "savings", "unit": "₹", "aggregation": "comparison"},
            "filters": {**fstate, "timeRange": label},
            "insight": {},
            "explanation": f"You are saving {rate:.1f}% of income.",
            "recommendation": "Reduce discretionary expenses to improve savings."
        })

    # C) CONCEPT QUERIES (no data required) → route to LLM
    if any(k in t for k in ["sip","tax","ppf","elss","nps"]) or ("what is" in t):
        llm_res = llm_concept_reply(req.message)
        if llm_res:
            topic_auto = llm_generate_topic(llm_res, req.message or "finance concept")
            return _respond(str(uid), topic_auto, "concept", {
                "data": llm_res.get("data", {}),
                "chart": llm_res.get("chart", {}),
                "chartMeta": llm_res.get("chartMeta", {"metric": "", "unit": "₹", "aggregation": "total"}),
                "filters": fstate,
                "insight": llm_res.get("insight", {}),
                "explanation": llm_res.get("explanation", ""),
                "recommendation": llm_res.get("recommendation", "")
            })
        concept = detect_concept_key(req.message)
        if concept:
            fb = concept_fallback_payload(concept, False)
            return _respond(str(uid), fb.get("topic", "finance concept"), "concept", {
                "data": {},
                "chart": {},
                "chartMeta": {"metric": "", "unit": "₹", "aggregation": "total"},
                "filters": fstate,
                "insight": {},
                "explanation": fb.get("explanation", ""),
                "recommendation": fb.get("recommendation", "")
            })
        return _respond(str(uid), "finance concept", "concept", {
            "data": {},
            "chart": {},
            "chartMeta": {"metric": "", "unit": "₹", "aggregation": "total"},
            "filters": fstate,
            "insight": {},
            "explanation": "I can explain this finance concept clearly.",
            "recommendation": "Please rephrase your concept query in one line so I can provide a precise answer."
        })

    # Default when no intent matched
    return _respond(str(uid), "no match", "default", {
        "data": {},
        "chartMeta": {"metric": "", "unit": "₹", "aggregation": "total"},
        "filters": fstate,
        "chart": {},
        "explanation": "Data not available for this request. Please add transactions.",
        "recommendation": ""
    })
