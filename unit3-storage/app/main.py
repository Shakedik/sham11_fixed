import os
import json
import logging
import httpx
from fastapi import FastAPI, HTTPException
from kafka import KafkaConsumer, KafkaProducer
import threading
from dotenv import load_dotenv
from urllib.parse import quote
import uuid

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Unit 3 - Storage Service", version="1.0.0")

# Kafka Configuration
KAFKA_BROKER = os.getenv('KAFKA_BROKER', 'kafka:9092')

# In-memory storage (replace with Firebase/DB in production)
articles_db = {}

# Kafka Producer
try:
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BROKER,
        value_serializer=lambda v: json.dumps(v).encode('utf-8')
    )
    logger.info(f"✅ Kafka Producer connected")
except Exception as e:
    logger.error(f"❌ Kafka Producer error: {e}")
    producer = None

def get_placeholder_url(word: str, entity_type: str) -> str:
    """Generate placeholder image URL"""
    color_map = {"PER": "007bff", "ORG": "dc3545", "LOC": "28a745", "MISC": "6c757d"}
    color = color_map.get(entity_type, "6c757d")
    text = f"{word.split()[0]} ({entity_type})"
    return f"https://placehold.co/100x100/{color}/FFFFFF/png?text={quote(text)}"

async def fetch_entity_image(word: str, entity_type: str) -> str:
    """Fetch image for entity from Wikimedia or return placeholder"""
    try:
        params = {
            "action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url",
            "generator": "search", "gsrsearch": f"{word} {entity_type.lower()}", 
            "gsrnamespace": 6, "gsrlimit": 1, "iiurlwidth": 100,
        }
        headers = {'User-Agent': 'Sham11NewsAggregator/1.0'}

        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(
                "https://commons.wikimedia.org/w/api.php",
                headers=headers,
                params=params
            )
            response.raise_for_status()
            data = response.json()
            
            pages = data.get("query", {}).get("pages", {})
            for page_id in pages:
                image_info = pages[page_id].get("imageinfo", [])
                if image_info:
                    return image_info[0].get("thumburl")
    except Exception as e:
        logger.warning(f"⚠️ Image fetch failed for {word}: {e}")
    
    return get_placeholder_url(word, entity_type)

async def process_images(article: dict) -> dict:
    """Add images to NER entities"""
    ner_arr = article.get('ner_arr', [])
    
    for entity in ner_arr:
        word = entity.get('word', '')
        entity_type = entity.get('entity', 'MISC')
        
        if word and not entity.get('image_url'):
            entity['image_url'] = await fetch_entity_image(word, entity_type)
    
    article['ner_arr'] = ner_arr
    return article

def save_article(article: dict) -> dict:
    """Save article to storage"""
    article_id = article.get('id') or str(uuid.uuid4())
    article['id'] = article_id
    articles_db[article_id] = article
    logger.info(f"💾 Saved article: {article_id}")
    return article

def kafka_consumer_thread():
    """Background thread consuming NER-processed news from Kafka"""
    try:
        consumer = KafkaConsumer(
            'ner-processed',
            bootstrap_servers=KAFKA_BROKER,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='earliest',
            group_id='storage-service-group'
        )
        logger.info("✅ Kafka Consumer started for 'ner-processed'")
        
        import asyncio
        
        for message in consumer:
            article = message.value
            logger.info(f"📨 Received article for storage: {article.get('title', 'No title')[:50]}")
            
            # Process images (async operation in sync context)
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            article = loop.run_until_complete(process_images(article))
            
            # Save to storage
            article = save_article(article)
            
            # Send final processed article
            if producer:
                producer.send('processed-news', value=article)
                logger.info(f"📤 Sent fully processed article to Kafka")
            
    except Exception as e:
        logger.error(f"❌ Kafka Consumer error: {e}")

@app.on_event("startup")
async def startup_event():
    logger.info("🟢 Starting Unit 3 - Storage Service...")
    
    # Start Kafka consumer in background
    consumer_thread = threading.Thread(target=kafka_consumer_thread, daemon=True)
    consumer_thread.start()
    
    logger.info("✅ Storage Service started")

@app.get("/")
def read_root():
    return {
        "service": "Unit 3 - Storage Service",
        "status": "running",
        "articles_count": len(articles_db)
    }

@app.get("/storage/articles/recent")
def get_recent_articles(limit: int = 20):
    """Get recent articles"""
    articles = list(articles_db.values())
    articles.reverse()  # Most recent first
    return {"data": articles[:limit]}

@app.get("/storage/articles/{article_id}")
def get_article(article_id: str):
    """Get specific article"""
    article = articles_db.get(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "storage_connected": True,
        "articles_count": len(articles_db)
    }
