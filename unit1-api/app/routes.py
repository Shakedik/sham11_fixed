import os
import json
import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from dotenv import load_dotenv
import httpx
from kafka import KafkaProducer
from transformers import pipeline
import torch
import asyncio
import re
from urllib.parse import quote # נדרש לקידוד URL של הפלייסהולדר

# ייבוא של שירותי האחסון המקומיים שלך (יש לוודא שהם קיימים)
from .storage_service import save_article, get_articles 

# --- 1. טעינת משתני סביבה (נשאר זהה) ---
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))
print("🔑 Loaded API key:", os.getenv("NEWSDATA_API_KEY"))

NER_MODEL_NAME = "dslim/bert-base-NER"
router = APIRouter(tags=["news"])

# --- 3. הגדרת Kafka Producer (נשאר זהה) ---
try:
    producer = KafkaProducer(
        bootstrap_servers="localhost:9092",
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        retries=3
    )
    print("✅ Kafka Producer התחבר בהצלחה")
except Exception as e:
    producer = None

# --- 4. אתחול מודל Hugging Face (נשאר זהה) ---
try:
    classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
except Exception as e:
    classifier = None

try:
    ner_pipeline = pipeline("ner", model=NER_MODEL_NAME, aggregation_strategy="simple")
except Exception as e:
    ner_pipeline = None

# --- 5. משתנים וקונפיגים (נשאר זהה) ---
CATEGORIES = ["Politics", "Business", "Science", "Sports", "Entertainment", "Technology"]
NEWSDATA_API_KEY = os.getenv("NEWSDATA_API_KEY", "")
NEWS_API_URL = "https://newsdata.io/api/1/news"
HTTP_TIMEOUT = 10


# ----------------------------------------------------
# 📌 פונקציות עזר לחיפוש תמונה (Wikimedia & Placeholder)
# ----------------------------------------------------
WIKIMEDIA_API_ENDPOINT = "https://commons.wikimedia.org/w/api.php"

def get_placeholder_url(word: str, entity_type: str) -> str:
    """מחזיר URL של תמונת פלייסהולדר דינמית (https://placehold.co)"""
    # יצירת צבע על בסיס סוג הישות
    color_map = {"PER": "007bff", "ORG": "dc3545", "LOC": "28a745", "MISC": "6c757d"}
    color = color_map.get(entity_type, "6c757d")
    
    # טקסט שיופיע על הפלייסהולדר (המילה הראשונה + סוג הישות)
    text = f"{word.split()[0]} ({entity_type})"
    
    # יצירת ה-URL
    return f"https://placehold.co/100x100/{color}/FFFFFF/png?text={quote(text)}"


async def get_entity_image_url_async(word: str, entity_type: str) -> str:
    """מחפש תמונה בוויקימדיה, אם נכשל - מחזיר פלייסהולדר."""
    
    # 1. ניסיון חיפוש בוויקימדיה (עם User-Agent)
    search_term = f"{word} {entity_type.lower()}" 
    params = {
        "action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url",
        "generator": "search", "gsrsearch": search_term, "gsrnamespace": 6, 
        "gsrlimit": 1, "iiurlwidth": 100,
    }
    headers = {'User-Agent': 'Sham11NewsAggregator/1.0 (Contact: your@email.com)'}

    async with httpx.AsyncClient(timeout=5) as client:
        try:
            response = await client.get(WIKIMEDIA_API_ENDPOINT, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            pages = data.get("query", {}).get("pages", {})
            for page_id in pages:
                image_info = pages[page_id].get("imageinfo", [])
                if image_info:
                    return image_info[0].get("thumburl") # ✅ הצליח: מחזיר URL מוויקימדיה
                    
        except Exception as e:
            print(f"Wikimedia Search failed for {word}: {e}")

    # 2. ✅ כשל: מחזיר תמונת פלייסהולדר כגיבוי חובה
    return get_placeholder_url(word, entity_type)


# ----------------------------------------------------
# 📌 Endpoint: הבאת חדשות אחרונות (הפונקציה המרכזית)
# ----------------------------------------------------
@router.get("/items/recent")
async def get_recent_items(category: Optional[str] = Query(None)):

    # --- בדיקות תקינות (נשאר זהה) ---
    if not NEWSDATA_API_KEY:
       raise HTTPException(status_code=500, detail="Missing NEWSDATA_API_KEY in environment variables.")
    if not classifier: raise HTTPException(status_code=500, detail="Hugging Face Classifier לא זמין")
    if not ner_pipeline: raise HTTPException(status_code=500, detail="Hugging Face NER Pipeline לא זמין")
    if not producer: raise HTTPException(status_code=500, detail="Kafka Producer לא זמין")


    params = {
        "apikey": NEWSDATA_API_KEY, "country": "us", "language": "en",
        "category": category.lower() if category else None, "size": 10,
    }
    params = {k: v for k, v in params.items() if v is not None}

    processed_count = 0
    allArray = []

    # --- שליפת נתונים מה-API (נשאר זהה) ---
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        try:
            response = await client.get(NEWS_API_URL, params=params)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to connect to NewsData API: {e}")

    # --- לולאת עיבוד כתבות ---
    for it in data.get("results", []):
        text = (it.get("title") or "") + " " + (it.get("description") or "")
        if not text.strip(): continue
            
        # --- סיווג (Classifier) ---
        try:
            classification = classifier(text, CATEGORIES)
            top_category = classification["labels"][0]
        except Exception as e:
            top_category = "General"

        # --- זיהוי ישויות (NER) וחיפוש תמונה ---
        ner_arr = []
        try:
            ner_results = ner_pipeline(text) 
            
            ner_tasks = []
            for res in ner_results:
                entity_type = res.get("entity_group") or res.get("entity")
                word = res["word"].replace('##', '').strip() 
                
                # מריץ חיפוש רק אם יש ישות
                if entity_type in ["PER", "ORG", "LOC", "MISC"]:
                    ner_tasks.append(get_entity_image_url_async(word, entity_type)) 
                else:
                    # עבור ישויות שאינן מעניינות, משתמשים בפלייסהולדר בסיסי או ב-None
                    ner_tasks.append(asyncio.sleep(0, result=None))
            
            image_urls = await asyncio.gather(*ner_tasks)
            
            # בניית המערך הסופי
            for i, res in enumerate(ner_results):
                clean_word = res["word"].replace('##', '').strip() 
                
                # אם image_urls[i] הוא None, נשתמש ב-None, אחרת ב-URL שחזר
                final_url = image_urls[i] if image_urls[i] else get_placeholder_url(clean_word, res.get("entity_group") or "MISC")
                
                ner_arr.append({
                    "entity": res.get("entity_group") or res.get("entity"),
                    "word": clean_word,
                    "score": float(res["score"]),
                    "image_url": final_url # 🚨 תמיד יחזיר URL (ויקימדיה או פלייסהולדר)
                })

        except Exception as e:
            print(f"שגיאת זיהוי ישויות (NER) או חיפוש תמונה: {e}")

        # --- בניית אובייקט הנתונים המלא ---
        item_data = {
            "id": it.get("article_id") or it.get("link"),
            "title": it.get("title") or "",
            "description": it.get("description"),
            "content": it.get("description"),
            "url": it.get("link") or "#",
            "image": it.get("image_url"),
            "source": it.get("source_id"),
            "category": top_category,
            "ner_arr": ner_arr,
        }
        allArray.append(item_data)

        # --- שמירה ל-DBaaS ושליחה ל-Kafka (נשאר זהה) ---
        try:
            save_article(item_data)
        except Exception as db_err:
            pass 

        try:
            producer.send(top_category, value={"id": item_data["id"], "category": top_category})
            processed_count += 1
        except Exception as kafka_err:
            pass

    return {
        "message": f"✅ עיבוד הסתיים — {processed_count} כתבות נשלחו ל-Kafka.",
        "data": allArray,
    }


# ----------------------------------------------------
# 📌 Endpoints נוספים (נשארים כפי שהיו)
# ----------------------------------------------------

@router.post("/save_article")
def add_article(article: dict):
    save_article(article)
    return {"status": "saved"}

@router.get("/articles/{article_id}")
def get_article_by_id(article_id: str):
    article = get_articles(article_id=article_id)
    if article:
        return article
    raise HTTPException(status_code=404, detail="Article not found in DBaaS")