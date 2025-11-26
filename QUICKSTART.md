# 🚀 Quick Start - מערכת מבוזרת ב-5 דקות

## 📦 מה בפנים?

4 יחידות עצמאיות + Kafka:
- **Unit 1**: API Gateway (Port 8001)
- **Unit 2**: NER Service (Port 8002)
- **Unit 3**: Storage Service (Port 8003)
- **Unit 4**: Frontend (Port 3000)
- **Kafka**: Message Broker (Port 9092)

## ⚡ התקנה מהירה

### שלב 1: הגדרות
```bash
# העתק .env
cp .env.example .env

# ערוך .env והוסף:
# NEWSDATA_API_KEY=your_key_here
```

### שלב 2: הפעלה
```bash
# הפעל הכל
docker-compose up -d

# או עם Makefile
make up
```

### שלב 3: בדיקה
```bash
# בדוק שהכל רץ
docker-compose ps

# או
make status
```

## ✅ האם זה עובד?

פתח דפדפן: http://localhost:3000

אתה אמור לראות את ממשק החדשות.

## 🧪 בדיקת זרימה מלאה

```bash
# 1. שלח חדשות לעיבוד
curl -X POST http://localhost:8001/api/news/fetch

# 2. צפה בזרימה ב-Kafka
make kafka-consume-processed

# 3. בדוק ב-Frontend
# החדשות יופיעו אוטומטית בזמן אמת!
```

## 📊 צפייה בלוגים

```bash
# כל השירותים
make logs

# יחידה ספציפית
make logs-unit1    # API Gateway
make logs-unit2    # NER Service
make logs-unit3    # Storage
make logs-unit4    # Frontend
make logs-kafka    # Kafka
```

## 🔍 Debug

### בעיה: יחידה לא עולה

```bash
# בדוק לוגים
docker-compose logs unit2-ner

# Restart
docker-compose restart unit2-ner
```

### בעיה: Kafka לא עובד

```bash
# Restart Kafka infrastructure
docker-compose restart zookeeper kafka

# בדוק health
docker-compose logs kafka | grep "started"
```

### בעיה: Frontend לא מתחבר

```bash
# בדוק WebSocket
# פתח Console בדפדפן וחפש שגיאות WS

# Restart API Gateway
docker-compose restart unit1-api
```

## 🛑 עצירה וניקוי

```bash
# עצור הכל
make down

# נקה לגמרי (מחק volumes!)
make clean
```

## 📈 צפייה ב-Kafka בזמן אמת

```bash
# חדשות גולמיות
make kafka-consume-raw

# חדשות מעובדות
make kafka-consume-processed

# רשימת topics
make kafka-topics
```

## 🎯 פקודות שימושיות

| Command | Description |
|---------|-------------|
| `make up` | הפעל הכל |
| `make down` | עצור הכל |
| `make logs` | צפה בלוגים |
| `make test` | בדוק תקינות |
| `make restart` | Restart הכל |
| `make build` | Build מחדש |
| `make clean` | נקה לגמרי |

## 🔄 זרימת נתונים

```
Frontend (3000)
    ↕ WebSocket
API Gateway (8001)
    ↓ Kafka: raw-news
NER Service (8002)
    ↓ Kafka: ner-processed
Storage Service (8003)
    ↓ Kafka: processed-news
API Gateway (8001)
    ↕ WebSocket
Frontend (3000) ✨
```

## 💡 טיפים

1. **חכה ל-Kafka**: לוקח 20-30 שניות עד שKafka מוכן
2. **צפה בלוגים**: `make logs` יראה לך מה קורה
3. **Health checks**: `make test` בודק שהכל תקין
4. **Restart אחרי שינויים**: `docker-compose restart <service>`

## 🎉 סיימת!

המערכת שלך רצה. עכשיו:
- פתח http://localhost:3000
- לחץ "שלח חדשות" או קרא ל-API
- צפה איך הכל עובד בזמן אמת!

---
**צריך עזרה?** ראה README.md המלא
