#!/usr/bin/env python3
"""
score_lead_general.py (with multi-key rotation)

Usage:
    python score_lead_general.py [--lead PATH] [--products PATH] [--config PATH] [--ask-model] [--force-to-raw]

Defaults (all files expected in same directory as this script):
    lead.json
    products.json
    config.json  (structure shown below)
    key_usage.json (created automatically to persist key usage stats)

config.json example:
{
    "Keys": {
        "Key1": "sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "Key2": "sk-or-v1-yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
    }
}

Notes:
- The script will read keys from config.json -> Keys and persist usage to key_usage.json.
- It will pick the least-used key (fewest 'attempts') for each request and rotate on failure.
- Requires 'requests' only if --ask-model is used: pip install requests
"""
import argparse
import json
import os
import re
import time
from difflib import SequenceMatcher
from typing import List, Tuple, Dict, Optional

try:
    import requests
except Exception:
    requests = None  # only needed if --ask-model used


# -----------------------
# File helpers
# -----------------------
def load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# -----------------------
# Similarity & parsing helpers
# -----------------------
def norm(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, (a or ""), (b or "")).ratio()


def max_similarity_to_products(text: str, products: List[dict], fields: List[str]) -> float:
    text = (text or "").strip().lower()
    best = 0.0
    for p in products:
        parts = []
        for f in fields:
            val = p.get(f)
            if isinstance(val, list):
                parts.append(" ".join(val))
            else:
                parts.append(str(val or ""))
        prod_text = " ".join(parts).strip().lower()
        best = max(best, similarity(text, prod_text))
    return best


def parse_time_posted(text: str) -> Optional[int]:
    if not text:
        return None
    text = text.strip().lower()
    m = re.search(r"(\d+)\s*min", text)
    if m:
        return int(m.group(1))
    m = re.search(r"(\d+)\s*h(?:r|rs|ours)?", text)
    if m:
        return int(m.group(1)) * 60
    m = re.search(r"(\d+)\s*d(?:ay|ays)?", text)
    if m:
        return int(m.group(1)) * 24 * 60
    m = re.search(r"(\d+)\s*m\b", text)
    if m:
        return int(m.group(1))
    m = re.search(r"(\d+)\s*h\b", text)
    if m:
        return int(m.group(1)) * 60
    if "just" in text or "sec" in text or "second" in text:
        return 0
    return None


def extract_numeric_from_engagement(s: str) -> Dict[str, int]:
    out = {}
    if not s:
        return out
    parts = re.split(r"[|,;]", s)
    for p in parts:
        m = re.search(r"([A-Za-z _]+)\s*[:\-]\s*(\d+)", p.strip())
        if m:
            k = m.group(1).strip().lower().replace(" ", "_")
            v = int(m.group(2))
            out[k] = v
    return out


# -----------------------
# Core scoring (unchanged)
# -----------------------
def compute_breakdown(lead: dict, products: List[dict]) -> Tuple[Dict, float]:
    lead_title = (lead.get("product_title") or "").strip()
    lead_parent = (lead.get("parent_category") or "").strip()
    lead_sub = (lead.get("sub_category") or "").strip()
    lead_cat_text = f"{lead_parent} {lead_sub}".strip()

    if lead_title:
        max_title_sim = max_similarity_to_products(lead_title, products, ["name"])
    else:
        max_title_sim = 0.0
    a_score = round(norm(max_title_sim) * 30, 6)

    if lead_cat_text:
        max_cat_sim = max_similarity_to_products(lead_cat_text, products, ["categories", "group", "name"])
    else:
        max_cat_sim = 0.0
    b_score = round(norm(max_cat_sim) * 30, 6)

    minutes = parse_time_posted(lead.get("time_posted", ""))
    c_score = 10 if (minutes is not None and minutes <= 30) else 0

    buyer_buys_text = (lead.get("buyer_buys") or "").strip()
    if buyer_buys_text:
        max_buys_sim = max_similarity_to_products(buyer_buys_text, products, ["name", "categories", "description"])
    else:
        max_buys_sim = 0.0
    d_score = round(norm(max_buys_sim) * 10, 6)

    other_points = 0.0
    max_other = 20.0

    if lead.get("mobile_verified"):
        other_points += 5.0
    if lead.get("whatsapp_available"):
        other_points += 3.0
    if lead.get("email") or lead.get("contact_email") or lead.get("email_address"):
        other_points += 2.0

    eng = extract_numeric_from_engagement(lead.get("buyer_engagement", ""))
    req = eng.get("requirements", eng.get("requirement", 0)) or 0
    calls = eng.get("calls", 0)
    replies = eng.get("replies", 0)
    eng_score = 0.0
    if req > 0:
        eng_score += min(4.0, 4.0 * (req / (req + 5)))
    eng_score += min(2.0, 2.0 * (calls / (calls + 2)))
    eng_score += min(2.0, 2.0 * (replies / (replies + 2)))
    eng_score = min(6.0, eng_score)
    other_points += eng_score

    member_since = (lead.get("member_since") or "").lower()
    ms_points = 0.0
    m = re.search(r"member since\s*(\d+)\s*(day|month|year|yr|week)s?", member_since)
    if m:
        n = int(m.group(1))
        unit = m.group(2)
        if unit.startswith("day") and n <= 30:
            ms_points = 1.5
        elif unit.startswith("week") and n <= 12:
            ms_points = 1.0
        elif unit.startswith("month") and n <= 6:
            ms_points = 0.7
        elif unit.startswith("year") and n <= 1:
            ms_points = 0.5
    other_points += ms_points

    lead_state = (lead.get("state") or "").strip().lower()
    lead_country = (lead.get("country") or "").strip().lower()
    location_hits = 0
    for p in products:
        specs = p.get("specifications") or {}
        for k, v in specs.items():
            try:
                if isinstance(v, str) and lead_country and lead_country in v.lower():
                    location_hits += 1
                if isinstance(v, str) and lead_state and lead_state in v.lower():
                    location_hits += 1
            except Exception:
                continue
    other_points += min(3.0, location_hits / max(1, len(products)) * 3.0)

    title_lower = (lead.get("product_title") or "").lower()
    keyword_boost = 0.0
    for kw, pts in [("gear", 1.5), ("hydraulic", 2.0), ("pump", 2.0), ("motor", 1.0), ("valve", 1.0)]:
        if kw in title_lower:
            keyword_boost += pts
    other_points += keyword_boost

    e_score = round(min(other_points, max_other), 6)

    total = round(a_score + b_score + c_score + d_score + e_score, 6)

    breakdown = {
        "a_title_similarity_ratio": round(max_title_sim, 6) if 'max_title_sim' in locals() else 0.0,
        "a_score_of_30": a_score,
        "b_category_similarity_ratio": round(max_cat_sim, 6) if 'max_cat_sim' in locals() else 0.0,
        "b_score_of_30": b_score,
        "c_time_posted_bin_of_10": c_score,
        "d_buyer_buys_similarity_ratio": round(max_buys_sim, 6) if 'max_buys_sim' in locals() else 0.0,
        "d_score_of_10": d_score,
        "e_other_raw_points": round(other_points, 6),
        "e_score_of_20": e_score,
        "total_score_out_of_100": total
    }
    return breakdown, total


def force_total_to_raw(breakdown: Dict, products: List[dict], lead: dict) -> Dict:
    lead_text = " ".join(filter(None, [
        lead.get("product_title") or "",
        lead.get("parent_category") or "",
        lead.get("sub_category") or ""
    ])).strip().lower()
    raw_sim = 0.0
    if lead_text:
        raw_sim = max_similarity_to_products(lead_text, products, ["name", "categories", "group", "description"])
    raw_target = round(raw_sim * 100, 6)

    a = breakdown["a_score_of_30"]
    b = breakdown["b_score_of_30"]
    c = breakdown["c_time_posted_bin_of_10"]
    d = breakdown["d_score_of_10"]

    needed = round(raw_target - (a + b + c + d), 6)
    new_e = min(max(0.0, needed), 20.0)

    if needed < 0 or needed > 20.0:
        sum_ab = a + b
        e_cap = 20.0
        if sum_ab <= 0.0:
            new_e = min(max(0.0, needed), 20.0)
        else:
            s = max(0.0, (raw_target - c - d - e_cap) / sum_ab)
            s = min(1.0, s)
            new_a = round(a * s, 6)
            new_b = round(b * s, 6)
            breakdown["a_score_of_30"] = new_a
            breakdown["b_score_of_30"] = new_b
            new_e = e_cap

    breakdown["e_score_of_20"] = round(new_e, 6)
    breakdown["total_score_out_of_100"] = round(
        breakdown["a_score_of_30"] + breakdown["b_score_of_30"] + breakdown["c_time_posted_bin_of_10"] + breakdown["d_score_of_10"] + breakdown["e_score_of_20"],
        6
    )
    breakdown["raw_similarity_target_out_of_100"] = raw_target
    return breakdown


# -----------------------
# Key rotation helpers
# -----------------------
USAGE_FILENAME = "key_usage.json"


def init_key_usage(keys: Dict[str, str]) -> Dict[str, dict]:
    """
    Ensures key_usage.json exists and contains entries for all keys.
    Returns the usage dict.
    Structure:
      {
        "Key1": {"attempts": 0, "success": 0, "last_used": 0.0},
        ...
      }
    """
    usage = {}
    if os.path.exists(USAGE_FILENAME):
        try:
            usage = load_json(USAGE_FILENAME)
        except Exception:
            usage = {}
    # Add missing keys
    for k in keys.keys():
        if k not in usage:
            usage[k] = {"attempts": 0, "success": 0, "last_used": 0.0}
    # Remove any keys no longer in config (optional; keep them but don't use)
    # Save back
    save_json(USAGE_FILENAME, usage)
    return usage


def save_key_usage(usage: Dict[str, dict]):
    save_json(USAGE_FILENAME, usage)


def select_keys_by_least_used(usage: Dict[str, dict], keys: Dict[str, str]) -> List[str]:
    """
    Returns list of key names sorted by least attempts first,
    tie-broken by oldest last_used timestamp.
    Only returns keys that are present in keys.
    """
    items = []
    for name, v in usage.items():
        if name not in keys:
            continue
        attempts = v.get("attempts", 0)
        last_used = v.get("last_used", 0.0)
        items.append((attempts, last_used, name))
    items.sort(key=lambda x: (x[0], x[1]))
    return [name for _, _, name in items]


# -----------------------
# OpenRouter wrapper using key rotation
# -----------------------
def call_openrouter_with_rotation(prompt: str, model: str, keys: Dict[str, str], timeout=20) -> dict:
    """
    Try the keys from config.json in order of least used. For each attempt:
      - increment 'attempts' and 'last_used' (persisted)
      - try request
      - on success increment 'success' and return
      - on failure (HTTP error, 429, network) try next key
    Raises exception if all keys exhausted.
    """
    if requests is None:
        raise RuntimeError("requests library not available. Install requests to use --ask-model.")

    # Initialize usage store
    usage = init_key_usage(keys)

    key_order = select_keys_by_least_used(usage, keys)
    last_exc = None

    for key_name in key_order:
        api_key = keys.get(key_name)
        if not api_key:
            continue

        # bump attempt and last_used immediately and persist
        usage.setdefault(key_name, {})
        usage[key_name]["attempts"] = usage[key_name].get("attempts", 0) + 1
        usage[key_name]["last_used"] = time.time()
        save_key_usage(usage)

        url = "https://api.openrouter.ai/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        body = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.0,
            "max_tokens": 400,
        }
        try:
            resp = requests.post(url, json=body, headers=headers, timeout=timeout)
            # treat non-200 codes specially
            if resp.status_code == 200:
                # success -> increment success counter and persist
                usage[key_name]["success"] = usage[key_name].get("success", 0) + 1
                usage[key_name]["last_used"] = time.time()
                save_key_usage(usage)
                return resp.json()
            else:
                # on rate limit or server error, try next key
                last_exc = RuntimeError(f"Key {key_name} -> HTTP {resp.status_code}: {resp.text}")
                # if it's 401 (invalid) don't retry too much; try next key
                # continue to next key
                continue
        except Exception as e:
            last_exc = e
            # network error: try next key
            continue

    # if we reach here, all keys failed
    raise RuntimeError("All keys failed for OpenRouter request. Last error: " + (str(last_exc) if last_exc else "unknown"))


# -----------------------
# CLI & main
# -----------------------
def main():
    parser = argparse.ArgumentParser(description="Score lead.json against products.json (multi-key OpenRouter rotation).")
    parser.add_argument("--lead", default="lead.json", help="Path to lead.json (default: ./lead.json)")
    parser.add_argument("--products", default="products.json", help="Path to products.json (default: ./products.json)")
    parser.add_argument("--config", default="config.json", help="Path to config.json containing Keys (default: ./config.json)")
    parser.add_argument("--ask-model", action="store_true", help="If set, call OpenRouter for a short explanation (requires keys in config.json)")
    parser.add_argument("--force-to-raw", action="store_true", help="Force total to equal raw textual similarity * 100 by adjusting e (and scaling a/b if needed)")
    args = parser.parse_args()

    # load files
    try:
        lead = load_json(args.lead)
    except Exception as e:
        print(f"Error reading lead file '{args.lead}': {e}")
        return

    try:
        products = load_json(args.products)
    except Exception as e:
        print(f"Error reading products file '{args.products}': {e}")
        return

    # compute breakdown locally (always)
    breakdown, total = compute_breakdown(lead, products)

    print("\n=== Relevance Breakdown (business-focused) ===")
    print(f"a (title /30):           {breakdown['a_score_of_30']} (ratio={breakdown['a_title_similarity_ratio']})")
    print(f"b (parent+sub /30):      {breakdown['b_score_of_30']} (ratio={breakdown['b_category_similarity_ratio']})")
    print(f"c (time_posted /10):     {breakdown['c_time_posted_bin_of_10']}")
    print(f"d (buyer_buys /10):      {breakdown['d_score_of_10']} (sim={breakdown['d_buyer_buys_similarity_ratio']})")
    print(f"e (other /20):           {breakdown['e_score_of_20']} (raw_points={breakdown['e_other_raw_points']})")
    print(f"TOTAL (out of 100):      {breakdown['total_score_out_of_100']}")
    print("====================================================\n")

    if args.force_to_raw:
        breakdown = force_total_to_raw(breakdown, products, lead)
        print("=== After forcing total to raw textual similarity ===")
        print(f"a (title /30):           {breakdown['a_score_of_30']} (ratio={breakdown.get('a_title_similarity_ratio')})")
        print(f"b (parent+sub /30):      {breakdown['b_score_of_30']} (ratio={breakdown.get('b_category_similarity_ratio')})")
        print(f"c (time_posted /10):     {breakdown['c_time_posted_bin_of_10']}")
        print(f"d (buyer_buys /10):      {breakdown['d_score_of_10']} (sim={breakdown.get('d_buyer_buys_similarity_ratio')})")
        print(f"e (other /20):           {breakdown['e_score_of_20']} (raw_points={breakdown.get('e_other_raw_points')})")
        print(f"RAW similarity target(%) {breakdown.get('raw_similarity_target_out_of_100')}")
        print(f"TOTAL (out of 100):      {breakdown['total_score_out_of_100']}")
        print("====================================================\n")

    # optionally call OpenRouter using keys from config.json
    if args.ask_model:
        # read config.json keys
        try:
            cfg = load_json(args.config)
            keys = cfg.get("Keys") or {}
            if not isinstance(keys, dict) or not keys:
                print("No keys found under 'Keys' in config.json. Skipping model call.")
                return
        except Exception as e:
            print(f"Error reading config.json '{args.config}': {e}. Skipping model call.")
            return

        if requests is None:
            print("requests library not available. Install with `pip install requests` to use --ask-model.")
            return

        model = os.environ.get("OPENROUTER_MODEL", "openrouter/gpt-3o-mini")

        prompt = (
            "Context: You are evaluating lead relevance for a business. "
            "lead.json represents a single incoming sales lead (a potential buyer) and its metadata. "
            "products.json represents the product catalog of the business (what the business sells). "
            "Task: Given the computed numeric breakdown below (a,b,c,d,e) for this lead, judge if the score reasonably reflects "
            "how relevant this lead is to the business' products. Think as a business evaluator: is this lead likely to be interested in "
            "or buy the business' products?\n\n"
            "Scoring scheme used:\n"
            "- a: product title similarity (out of 30)\n"
            "- b: parent_category + sub_category similarity (out of 30)\n"
            "- c: time_posted (binary 10 if <=30 minutes else 0)\n"
            "- d: buyer_buys similarity/heuristic (out of 10)\n"
            "- e: other metadata quality (out of 20)\n\n"
            "Lead (lead.json):\n" + json.dumps(lead, indent=2) + "\n\n"
            "Products (first 10 entries):\n" + json.dumps(products[:10], indent=2) + "\n\n"
            "Computed breakdown:\n" + json.dumps(breakdown, indent=2) + "\n\n"
            "Please respond with a short JSON object: {ok: bool, comment: str} where 'ok' indicates if the numeric breakdown is reasonable "
            "from a business-relevance POV and 'comment' is 1-3 sentences explaining the main reasons. Evaluate only business relevance."
        )

        try:
            resp = call_openrouter_with_rotation(prompt=prompt, model=model, keys=keys)
            assistant_text = None
            if isinstance(resp, dict):
                choices = resp.get("choices") or []
                if choices:
                    first = choices[0]
                    msg = first.get("message") or first.get("delta") or {}
                    assistant_text = msg.get("content") or first.get("text")
            print("=== Model explanation (from OpenRouter) ===")
            if assistant_text:
                print(assistant_text)
            else:
                print(json.dumps(resp, indent=2))
        except Exception as e:
            print("OpenRouter API call failed (after trying all keys):", str(e))


if __name__ == "__main__":
    main()
