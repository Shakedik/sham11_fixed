import firebase_admin
from firebase_admin import credentials, firestore
import os

# --- אתחול Firebase ---
try:
    if not firebase_admin._apps:
        cred_path = os.path.join(os.path.dirname(__file__), "firebase_key.json")
        if not os.path.exists(cred_path):
            raise FileNotFoundError(f"⚠️ לא נמצא קובץ firebase_key.json בנתיב: {cred_path}")
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase initialized successfully.")
except Exception as e:
    print(f"❌ Firebase initialization failed: {e}")

# --- יצירת לקוח Firestore ---
try:
    db = firestore.client()
except Exception as e:
    print(f"❌ Firestore client error: {e}")
    db = None

# --- פונקציה לשמירת כתבה ---
def save_article(article: dict):
    if not db:
        print("⚠️ Firestore client unavailable, skipping save.")
        return
    try:
        db.collection("articles").document(article["id"]).set(article)
        print(f"✅ Article saved: {article['id']}")
    except Exception as e:
        print(f"❌ Failed to save article: {e}")

# --- פונקציה לשליפת כתבות ---
def get_articles(article_id=None):
    if not db:
        print("⚠️ Firestore client unavailable, cannot fetch articles.")
        return []

    try:
        if article_id:
            doc = db.collection("articles").document(article_id).get()
            return doc.to_dict() if doc.exists else None
        else:
            docs = db.collection("articles").order_by("published_at", direction=firestore.Query.DESCENDING).stream()
            return [doc.to_dict() for doc in docs]
    except Exception as e:
        print(f"❌ Failed to fetch articles: {e}")
        return []
