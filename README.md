# 🚀 Sham11 - Distributed News Platform

## 📐 ארכיטקטורה מבוזרת (4 יחידות + Kafka)

```
┌──────────────────────────────────────────────────────┐
│                   Unit 4: Frontend                    │
│                  React + WebSocket                    │
│                     Port: 3000                        │
└─────────────────────┬────────────────────────────────┘
                      │ HTTP/WS
                      ↓
┌──────────────────────────────────────────────────────┐
│              Unit 1: API Gateway                      │
│          FastAPI + WebSocket Manager                  │
│                   Port: 8001                          │
└──────┬───────────────────────────────────────┬───────┘
       │                                       │
       │ Kafka Topics:                         │
       │ • raw-news                           │
       │ • ner-processed                      │
       │ • processed-news                     │
       │                                       │
       ↓                                       ↓
┌─────────────────────┐            ┌─────────────────────┐
│   Unit 2: NER       │            │  Unit 3: Storage    │
│   Transformer ML    │            │  Image + Firebase   │
│   Port: 8002        │            │  Port: 8003         │
└──────┬──────────────┘            └──────┬──────────────┘
       │                                   │
       └──────────┬────────────────────────┘
                  │
                  ↓
         ┌────────────────────┐
         │   Apache Kafka     │
         │   Message Broker   │
         │   Port: 9092       │
         └────────────────────┘
```

## 🔄 זרימת הנתונים

### Pipeline מלא:

1. **Unit 1 (API Gateway)** מקבל חדשות חדשות
   ↓
2. שולח ל-Kafka topic: `raw-news`
   ↓
3. **Unit 2 (NER Service)** מעבד NER
   ↓
4. שולח ל-Kafka topic: `ner-processed`
   ↓
5. **Unit 3 (Storage Service)** מוסיף תמונות + שומר
   ↓
6. שולח ל-Kafka topic: `processed-news`
   ↓
7. **Unit 1 (API Gateway)** מקבל חזרה
   ↓
8. שידור ל-**Unit 4 (Frontend)** דרך WebSocket

## 🏗️ מבנה הפרויקט

```
news-distributed/
├── unit1-api/              # API Gateway
│   ├── app/
│   │   ├── main.py        # FastAPI + Kafka Consumer/Producer
│   │   ├── routes.py      # Original routes
│   │   └── websocket_manager.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── unit2-ner/             # NER Processing
│   ├── app/
│   │   ├── main.py       # NER Service + Kafka
│   │   └── ner_service.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── unit3-storage/         # Storage + Images
│   ├── app/
│   │   ├── main.py       # Storage Service + Kafka
│   │   ├── storage_service.py
│   │   └── image_service.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── unit4-frontend/        # React Frontend
│   ├── src/
│   │   ├── components/   # All React components
│   │   ├── pages/        # Page components
│   │   ├── Home.jsx
│   │   └── main.jsx
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml    # Orchestrates all 4 units + Kafka
└── README.md            # This file
```

## 🚀 התקנה והרצה

### דרישות מקדימות
- Docker & Docker Compose
- 8GB RAM מינימום
- Ports: 3000, 8001-8003, 9092, 2181

### 1. הגדרת משתני סביבה

```bash
cat > .env << 'EOF'
# Kafka (auto-configured)
KAFKA_BROKER=kafka:9092

# External APIs
NEWSDATA_API_KEY=your_newsdata_api_key

# Cloudinary (optional)
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
EOF
```

### 2. הרצה

```bash
# הפעל את כל המערכת
docker-compose up -d

# צפה בלוגים
docker-compose logs -f

# בדוק סטטוס
docker-compose ps
```

### 3. גישה לשירותים

- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:8001
- **NER Service**: http://localhost:8002
- **Storage Service**: http://localhost:8003

## 📊 Kafka Topics

| Topic | Producer | Consumer | Description |
|-------|----------|----------|-------------|
| `raw-news` | Unit 1 | Unit 2 | חדשות גולמיות מה-API |
| `ner-processed` | Unit 2 | Unit 3 | אחרי עיבוד NER |
| `processed-news` | Unit 3 | Unit 1 | מוכן לשידור ללקוחות |

### צפייה בהודעות Kafka בזמן אמת

```bash
# Topic: raw-news
docker-compose exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic raw-news \
  --from-beginning

# Topic: processed-news
docker-compose exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic processed-news \
  --from-beginning
```

## 🔧 פיתוח

### הרצת יחידה בודדת

```bash
# Unit 1 - API Gateway
cd unit1-api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001

# Unit 2 - NER Service
cd unit2-ner
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8002

# Unit 3 - Storage Service
cd unit3-storage
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8003

# Unit 4 - Frontend
cd unit4-frontend
npm install
npm run dev
```

**שים לב**: Kafka חייב לרוץ ב-Docker גם בפיתוח מקומי:
```bash
docker-compose up zookeeper kafka -d
```

## 🧪 בדיקות

### בדיקת זרימת נתונים מלאה

```bash
# 1. שלח חדשות חדשות
curl -X POST http://localhost:8001/api/news/fetch

# 2. צפה ב-Kafka logs
docker-compose logs -f unit2-ner unit3-storage

# 3. בדוק ב-Frontend
open http://localhost:3000
```

### Health Checks

```bash
# Unit 1
curl http://localhost:8001/

# Unit 2
curl http://localhost:8002/health

# Unit 3
curl http://localhost:8003/health
```

## 🐛 פתרון בעיות

### Kafka לא עולה

```bash
# Restart Kafka infrastructure
docker-compose restart zookeeper kafka

# בדוק לוגים
docker-compose logs kafka

# ודא ש-Zookeeper פעיל
docker-compose logs zookeeper
```

### יחידה לא מתחברת ל-Kafka

```bash
# בדוק שKafka עלה לפני היחידות
docker-compose ps

# Restart היחידה
docker-compose restart unit2-ner
```

### Frontend לא מתעדכן

```bash
# בדוק WebSocket connection
# פתח Console בדפדפן וחפש שגיאות

# Restart API Gateway
docker-compose restart unit1-api
```

### Build מחדש

```bash
# Build יחידה ספציפית
docker-compose build unit2-ner

# Build הכל
docker-compose build

# Build והרץ
docker-compose up --build
```

## 📈 Scaling

כל יחידה יכולה לרוץ על שרת נפרד:

### הרצה מבוזרת (Multi-Server)

**Server 1 - Kafka:**
```bash
docker-compose up zookeeper kafka
```

**Server 2 - API Gateway:**
```bash
# עדכן KAFKA_BROKER ב-.env
KAFKA_BROKER=<server1-ip>:9092
docker-compose up unit1-api
```

**Server 3 - NER Service:**
```bash
KAFKA_BROKER=<server1-ip>:9092
docker-compose up unit2-ner
```

**Server 4 - Storage Service:**
```bash
KAFKA_BROKER=<server1-ip>:9092
docker-compose up unit3-storage
```

**Server 5 - Frontend:**
```bash
VITE_API_URL=http://<server2-ip>:8001
docker-compose up unit4-frontend
```

## 🎯 יתרונות הארכיטקטורה

✅ **מבוזרת**: כל יחידה רצה בנפרד  
✅ **Scalable**: הוסף instances לפי עומס  
✅ **Resilient**: כשל ביחידה אחת לא משפיע על האחרות  
✅ **Maintainable**: עדכון קוד ליחידה אחת בלבד  
✅ **Real-time**: Kafka מבטיח שידור מהיר  
✅ **Async Processing**: כל יחידה עובדת במקביל  

## 🔒 Production Considerations

- [ ] הוסף authentication ל-API Gateway
- [ ] הגדר SSL/TLS לכל השירותים
- [ ] החלף in-memory storage ב-Firebase/PostgreSQL
- [ ] הוסף monitoring (Prometheus + Grafana)
- [ ] הגדר Kafka replication
- [ ] הוסף rate limiting
- [ ] הגדר logging מרכזי
- [ ] הוסף health checks אוטומטיים

## 📝 רישיון

MIT License

---

**Built with ❤️ by Sham11 Team**
# sham11_fixed
