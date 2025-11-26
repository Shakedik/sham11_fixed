import os
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import httpx
import logging
from kafka import KafkaConsumer, KafkaProducer
import threading
from typing import List

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Unit 1 - API Gateway", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"✅ Client connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"🔴 Client disconnected. Total: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        """Broadcast to all connected clients"""
        for connection in self.active_connections[:]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting: {e}")
                self.disconnect(connection)

manager = ConnectionManager()

# Kafka Configuration
KAFKA_BROKER = os.getenv('KAFKA_BROKER', 'kafka:9092')
NER_SERVICE_URL = os.getenv('NER_SERVICE_URL', 'http://unit2-ner:8002')
STORAGE_SERVICE_URL = os.getenv('STORAGE_SERVICE_URL', 'http://unit3-storage:8003')

# Kafka Producer for sending raw news
try:
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BROKER,
        value_serializer=lambda v: json.dumps(v).encode('utf-8')
    )
    logger.info(f"✅ Kafka Producer connected to {KAFKA_BROKER}")
except Exception as e:
    logger.error(f"❌ Kafka Producer error: {e}")
    producer = None

# Kafka Consumer for receiving processed news
def kafka_consumer_thread():
    """Background thread consuming processed news from Kafka"""
    try:
        consumer = KafkaConsumer(
            'processed-news',
            bootstrap_servers=KAFKA_BROKER,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='latest',
            group_id='api-gateway-group'
        )
        logger.info("✅ Kafka Consumer started for 'processed-news'")
        
        for message in consumer:
            news_item = message.value
            logger.info(f"📨 Received processed news: {news_item.get('id')}")
            
            # Broadcast to WebSocket clients
            import asyncio
            import concurrent.futures
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(manager.broadcast(news_item))
            
    except Exception as e:
        logger.error(f"❌ Kafka Consumer error: {e}")

@app.on_event("startup")
async def startup_event():
    logger.info("🟢 Starting Unit 1 - API Gateway...")
    
    # Start Kafka consumer in background
    consumer_thread = threading.Thread(target=kafka_consumer_thread, daemon=True)
    consumer_thread.start()
    
    logger.info("✅ API Gateway started")

@app.get("/")
def read_root():
    return {
        "service": "Unit 1 - API Gateway",
        "status": "running",
        "endpoints": ["/api/items/recent", "/api/articles/{id}", "/ws"]
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time updates"""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"📨 Received from client: {data}")
            # Handle subscription logic if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

@app.get("/api/items/recent")
async def get_recent_items():
    """Get recent articles from storage service"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{STORAGE_SERVICE_URL}/storage/articles/recent",
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"❌ Error fetching from storage: {e}")
        return {"data": [], "error": str(e)}

@app.get("/api/articles/{article_id}")
async def get_article(article_id: str):
    """Get specific article from storage service"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{STORAGE_SERVICE_URL}/storage/articles/{article_id}",
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"❌ Error fetching article: {e}")
        raise HTTPException(status_code=404, detail="Article not found")

@app.post("/api/news/fetch")
async def fetch_news():
    """Fetch news and send to processing pipeline via Kafka"""
    try:
        # Fetch news from external API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://newsdata.io/api/1/news",
                params={
                    "apikey": os.getenv("NEWSDATA_API_KEY"),
                    "language": "en"
                },
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()
        
        results = data.get('results', [])
        
        # Send each article to Kafka for processing
        for article in results:
            if producer:
                producer.send('raw-news', value=article)
                logger.info(f"📤 Sent article to Kafka: {article.get('title', 'No title')[:50]}")
        
        return {"message": f"Sent {len(results)} articles for processing"}
    
    except Exception as e:
        logger.error(f"❌ Error fetching news: {e}")
        raise HTTPException(status_code=500, detail=str(e))
