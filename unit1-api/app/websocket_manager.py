import asyncio
import json
import threading
from fastapi import WebSocket, WebSocketDisconnect
from kafka import KafkaConsumer
from typing import List, Dict, Any, Optional
import time 
import sys # נדרש לבדיקת Event Loop

# 🚨 נשתמש במשתנה גלובלי זה כדי לשמור את Event Loop של FastAPI
GLOBAL_EVENT_LOOP: Optional[asyncio.AbstractEventLoop] = None

class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.consumer_thread: Optional[threading.Thread] = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"✅ WebSocket Client connected: {websocket.client}")

        await websocket.send_text("✅ חיבור לשרת התקבל בהצלחה!")

        try:
            while True:
                # מקשיב להודעות מהלקוח (למשל, subscribe)
                data = await websocket.receive_text()
                print(f"📨 Received message from client: {data}")
        except WebSocketDisconnect:
            print("⚠️ WebSocket disconnected by client")
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
        finally:
            self.active_connections.remove(websocket)


    async def send_json(self, data: Dict[str, Any]):
        """Sends a valid JSON object to all active clients."""
        for conn in list(self.active_connections):
            try:
                await conn.send_json(data)
            except RuntimeError:
                # Handles connection closed while sending
                self.active_connections.remove(conn)
            except Exception as e:
                print(f"❌ Error sending JSON to client: {e}")
                self.active_connections.remove(conn)


    def start_kafka_consumer(self):
        """Starts a background thread consumer for Kafka."""
        if self.consumer_thread and self.consumer_thread.is_alive():
            print("ℹ️ Kafka consumer is already running.")
            return

        def consume():
            global GLOBAL_EVENT_LOOP
            
            # 🚨 ממתין שה-Event Loop של FastAPI יופעל לפני שמתחיל
            while GLOBAL_EVENT_LOOP is None:
                 # print("Waiting for GLOBAL_EVENT_LOOP...") # הודעת דיבוג
                 time.sleep(0.5)
            
            # 🚨 בדיקה נוספת לוודא שה-Loop פועל
            if not GLOBAL_EVENT_LOOP.is_running() and not GLOBAL_EVENT_LOOP.is_closed():
                 # במקרים נדירים, ייתכן שצריך להתחיל את ה-loop באופן ידני ב-thread
                 print("Event loop not running, attempting to set up.")
                 # (בסביבת Uvicorn/FastAPI זה לא אמור לקרות)

            try:
                consumer = KafkaConsumer(
                    bootstrap_servers="localhost:9092",
                    auto_offset_reset="earliest",
                    group_id="news-consumers",
                    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                )
                topics = ["Politics", "Finance", "Science", "Sport", "Culture"]
                consumer.subscribe(topics)
                print(f"✅ Kafka Consumer subscribed to topics: {topics}")

                for msg in consumer:
                    data = msg.value # data is already a Python dict
                    
                    # 🚨 התיקון הקריטי: שולח את המשימה ל-Loop הקיים ללא חסימה
                    # משתמש ב-run_coroutine_threadsafe ושומר את ה-Future
                    asyncio.run_coroutine_threadsafe(self.broadcast(data), GLOBAL_EVENT_LOOP)
                    
            except Exception as e:
                print(f"❌ Kafka Consumer Error: {e}")

        self.consumer_thread = threading.Thread(target=consume, daemon=True)
        self.consumer_thread.start()

    async def broadcast(self, data: Dict[str, Any]):
        """Broadcasts the data object as valid JSON."""
        await self.send_json(data)


# יצירת מופע גלובלי
websocket_manager = WebSocketManager()