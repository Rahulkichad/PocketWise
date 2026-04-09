import os
from datetime import datetime, timezone
from typing import Dict, List, Tuple
from pymongo import MongoClient
import numpy as np
try:
    import xgboost as xgb
except:
    xgb = None

def risk_allocation(risk: str, age: int) -> Dict[str, float]:
    base = {
        "Conservative": {"SIP": 0.40, "PPF": 0.35, "NPS": 0.20, "ELSS": 0.05},
        "Moderate": {"SIP": 0.50, "PPF": 0.25, "NPS": 0.15, "ELSS": 0.10},
        "Aggressive": {"SIP": 0.65, "PPF": 0.10, "NPS": 0.10, "ELSS": 0.15},
    }.get(risk or "Moderate", {"SIP": 0.50, "PPF": 0.25, "NPS": 0.15, "ELSS": 0.10})
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
    total = sum(base.values())
    return {k: v / total for k, v in base.items()}

def encode_risk(r: str) -> float:
    m = {"Conservative": 0.0, "Moderate": 0.5, "Aggressive": 1.0}
    return m.get(r or "Moderate", 0.5)

def month_bounds(now: datetime) -> Tuple[datetime, datetime]:
    start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    if now.month == 12:
        end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
    return start, end

def get_dataset(db) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, List[str]]:
    users = list(db.users.find({}))
    now = datetime.now(timezone.utc)
    start, end = month_bounds(now)
    feats = []
    y_e = []
    y_d = []
    y_t = []
    cols = ["age","riskProfile","monthlyIncome","investableMonthly","goalCount","savingsRate","volatilityTolerance","taxUsageRatio","timeHorizon"]
    for u in users:
        p = u.get("profile") or {}
        age = int(p.get("age") or 0)
        risk = p.get("riskProfile") or "Moderate"
        income = float(p.get("monthlyIncome") or 0.0)
        goals = list(db.goals.find({"userId": u["_id"]}))
        goal_count = len(goals)
        tx = db.transactions
        inc_rows = list(tx.aggregate([
            {"$match": {"userId": u["_id"], "type": "income", "date": {"$gte": start, "$lt": end}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]))
        exp_rows = list(tx.aggregate([
            {"$match": {"userId": u["_id"], "type": "expense", "date": {"$gte": start, "$lt": end}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]))
        inc = float(inc_rows[0]["total"]) if inc_rows else 0.0
        exp = float(exp_rows[0]["total"]) if exp_rows else 0.0
        sav = max(0.0, inc - exp)
        investable = sav * 0.5
        savings_rate = (sav / inc) if inc > 0 else 0.0
        vol_tol = encode_risk(risk)
        eighty_c_cap = 150000.0 / 12.0
        sav_rows = list(tx.aggregate([
            {"$match": {"userId": u["_id"], "type": "expense", "category": "Savings", "date": {"$gte": start, "$lt": end}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]))
        sav_spent = float(sav_rows[0]["total"]) if sav_rows else 0.0
        tax_ratio = min(1.0, sav_spent / eighty_c_cap) if eighty_c_cap > 0 else 0.0
        horizon_months = 0.0
        if goals:
            total_days = 0
            cnt = 0
            for g in goals:
                dt = g.get("targetDate")
                try:
                    d = dt if isinstance(dt, datetime) else datetime.fromisoformat(str(dt))
                except:
                    d = now
                try:
                    if d.tzinfo is None:
                        d = d.replace(tzinfo=timezone.utc)
                    else:
                        d = d.astimezone(timezone.utc)
                except:
                    d = now
                total_days += max(0, (d - now).days)
                cnt += 1
            avg_days = total_days / max(1, cnt)
            horizon_months = avg_days / 30.0
        feats.append([age, encode_risk(risk), income, investable, goal_count, savings_rate, vol_tol, tax_ratio, horizon_months])
        base_w = risk_allocation(risk, age)
        y_e.append(0.0)
        y_d.append(0.0)
        y_t.append(0.0)
    X = np.array(feats, dtype=float) if feats else np.zeros((1, len(cols)), dtype=float)
    y_e = np.array(y_e, dtype=float) if y_e else np.zeros((1,), dtype=float)
    y_d = np.array(y_d, dtype=float) if y_d else np.zeros((1,), dtype=float)
    y_t = np.array(y_t, dtype=float) if y_t else np.zeros((1,), dtype=float)
    return X, y_e, y_d, y_t, cols

def train_and_save():
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/pocketwise")
    client = MongoClient(uri)
    db = client.get_default_database()
    X, y_e, y_d, y_t, cols = get_dataset(db)
    if xgb is None:
        return
    params = {"max_depth": 3, "eta": 0.1, "lambda": 10.0, "objective": "reg:squarederror", "seed": 42}
    dtrain_e = xgb.DMatrix(X, label=y_e, feature_names=cols)
    dtrain_d = xgb.DMatrix(X, label=y_d, feature_names=cols)
    dtrain_t = xgb.DMatrix(X, label=y_t, feature_names=cols)
    if X.shape[0] > 3:
        idx = np.arange(X.shape[0])
        np.random.seed(42)
        np.random.shuffle(idx)
        k = 3
        fold_size = X.shape[0] // k
        for i in range(k):
            s = i * fold_size
            e = (i + 1) * fold_size if i < k - 1 else X.shape[0]
            val_idx = idx[s:e]
            tr_idx = np.concatenate([idx[:s], idx[e:]])
            dtr_e = xgb.DMatrix(X[tr_idx], label=y_e[tr_idx], feature_names=cols)
            dval_e = xgb.DMatrix(X[val_idx], label=y_e[val_idx], feature_names=cols)
            dtr_d = xgb.DMatrix(X[tr_idx], label=y_d[tr_idx], feature_names=cols)
            dval_d = xgb.DMatrix(X[val_idx], label=y_d[val_idx], feature_names=cols)
            dtr_t = xgb.DMatrix(X[tr_idx], label=y_t[tr_idx], feature_names=cols)
            dval_t = xgb.DMatrix(X[val_idx], label=y_t[val_idx], feature_names=cols)
            xgb.train(params, dtr_e, num_boost_round=30)
            xgb.train(params, dtr_d, num_boost_round=30)
            xgb.train(params, dtr_t, num_boost_round=30)
    model_e = xgb.train(params, dtrain_e, num_boost_round=50)
    model_d = xgb.train(params, dtrain_d, num_boost_round=50)
    model_t = xgb.train(params, dtrain_t, num_boost_round=50)
    base_dir = os.path.join(os.path.dirname(__file__), "models")
    os.makedirs(base_dir, exist_ok=True)
    model_e.save_model(os.path.join(base_dir, "equity.json"))
    model_d.save_model(os.path.join(base_dir, "debt.json"))
    model_t.save_model(os.path.join(base_dir, "tax.json"))

if __name__ == "__main__":
    train_and_save()
