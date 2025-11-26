import os
import json
import logging
from fastapi import FastAPI
from kafka import KafkaConsumer, KafkaProducer
from transformers import pipeline
import threading
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Unit 2 - NER Service", version="1.0.0")

# Kafka Configuration
KAFKA_BROKER = os.getenv('KAFKA_BROKER', 'kafka:9092')

# Initialize NER Pipeline
try:
    ner_pipeline = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
    logger.info("✅ NER Pipeline loaded successfully")
except Exception as e:
    logger.error(f"❌ Failed to load NER Pipeline: {e}")
    ner_pipeline = None

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

def process_ner(article: dict) -> dict:
    """Process article with NER"""
    if not ner_pipeline:
        logger.warning("⚠️ NER Pipeline not available")
        article['ner_arr'] = []
        return article
    
    try:
        # Extract text for NER
        text = f"{article.get('title', '')} {article.get('description', '')}"
        
        # Run NER
        entities = ner_pipeline(text)
        
        # Format results
        ner_results = []
        for entity in entities:
            ner_results.append({
                "word": entity.get('word', ''),
                "entity": entity.get('entity_group', 'MISC'),
                "score": float(entity.get('score', 0.0)),
                "image_url": None  # Will be filled by storage service
            })
        
        article['ner_arr'] = ner_results
        logger.info(f"✅ NER processed: {len(ner_results)} entities found")
        
    except Exception as e:
        logger.error(f"❌ NER processing error: {e}")
        article['ner_arr'] = []
    
    return article

def kafka_consumer_thread():
    """Background thread consuming raw news from Kafka"""
    try:
        consumer = KafkaConsumer(
            'raw-news',
            bootstrap_servers=KAFKA_BROKER,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='earliest',
            group_id='ner-service-group'
        )
        logger.info("✅ Kafka Consumer started for 'raw-news'")
        
        for message in consumer:
            article = message.value
            logger.info(f"📨 Received article for NER: {article.get('title', 'No title')[:50]}")
            
            # Process with NER
            processed_article = process_ner(article)
            
            # Send to next stage (storage service)
            if producer:
                producer.send('ner-processed', value=processed_article)
                logger.info(f"📤 Sent NER-processed article to Kafka")
            
    except Exception as e:
        logger.error(f"❌ Kafka Consumer error: {e}")

@app.on_event("startup")
async def startup_event():
    logger.info("🟢 Starting Unit 2 - NER Service...")
    
    # Start Kafka consumer in background
    consumer_thread = threading.Thread(target=kafka_consumer_thread, daemon=True)
    consumer_thread.start()
    
    logger.info("✅ NER Service started")

@app.get("/")
def read_root():
    return {
        "service": "Unit 2 - NER Service",
        "status": "running",
        "ner_model": "dslim/bert-base-NER",
        "pipeline_ready": ner_pipeline is not None
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "ner_ready": ner_pipeline is not None
    }
