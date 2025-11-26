import React, { useEffect, useState, useCallback, useMemo } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { useLocation, Link, useNavigate } from "react-router-dom"; 
import CategoryPicker from "./components/CategoryPicker";
import NewsCard from "./components/NewsCard";

const WS_URL = "ws://127.0.0.1:8001/ws";
const API_URL = "http://127.0.0.1:8001/api/items/recent";
const NER_ENTITIES = ["PER", "ORG", "LOC", "MISC"]; 

export default function Home() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const initialLoadRef = React.useRef(true);
  const navigate = useNavigate();

  // --- לוגיקה לטיפול בפרמטרי URL ובמצבי סינון ---
  const location = useLocation();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const initialFilterType = queryParams.get('filterType') || 'Category';
  const initialEntityFilter = queryParams.get('entityFilter') || ''; 
  const initialWordFilter = queryParams.get('wordFilter') || ''; 
  
  const [filterType, setFilterType] = useState(initialFilterType); 
  const [category, setCategory] = useState(""); 
  const [entityFilter, setEntityFilter] = useState(initialEntityFilter);
  const [wordFilter, setWordFilter] = useState(initialWordFilter); 


  // --- WebSocket setup ---
  const { sendMessage, lastMessage, readyState } = useWebSocket(WS_URL, {
    onOpen: () => {
      console.log("✅ WebSocket connection opened");
      setError("");

      if (initialLoadRef.current) {
        console.log("📡 Triggering initial data flow (Producer)");
        fetch(API_URL)
        .then((response) => {
            if (!response.ok) {
                // 🚨 טיפול בשגיאת HTTP
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then((result) => {
            setItems(result.data || []); 
        })
        .catch((err) => {
            console.error("❌ Error fetching initial data:", err);
            // 🚨 הצגת שגיאה ב-UI
            setError(`שגיאה בטעינת נתונים ראשונית מה-API: ${err.message}. ודא שהשרת פועל.`);
        })
        .finally(() => {
            initialLoadRef.current = false;
        });
      }
    },
    onClose: () => { console.warn("⚠️ WebSocket connection closed"); },
    onError: (event) => { setError("שגיאת חיבור ל-WebSocket. ודא שהשרת רץ על port 8000."); },
    shouldReconnect: () => true,
  });
  
  // 🚨 פונקציה חדשה לעיבוד הודעות WebSocket (מטפלת בקידוד וב-JSON)
  const handleMessageProcessing = useCallback((textData) => {
    try {
        // ניקוי תווים לא תקניים (התמודדות עם שגיאת ה-SyntaxError)
        let cleanData = textData.replace(/[^\x20-\x7E]/g, '').trim(); 
        
        if (!cleanData) return;

        const message = JSON.parse(cleanData);

        if (!message || typeof message !== 'object' || !message.id || !message.category) {
            console.warn("Skipping invalid message:", message);
            return;
        }

        console.log("🆕 Received notification:", message);
        
        setItems((prevItems) => {
          if (prevItems.some((item) => item.id === message.id)) return prevItems;
          return [message, ...prevItems.slice(0, 19)];
        });
        
    } catch (e) {
        console.error("❌ Error parsing FINAL WebSocket message:", e);
    }
  }, []);


  // --- Handle incoming WebSocket messages (מעודכן לטיפול ב-Parsing) ---
  useEffect(() => {
    if (!lastMessage?.data) return;

    let rawData = lastMessage.data;

    if (rawData instanceof Blob) {
        // טיפול בנתונים בינאריים (Blob)
        const reader = new FileReader();
        reader.onload = () => {
            handleMessageProcessing(reader.result);
        };
        reader.onerror = (e) => {
            console.error("❌ FileReader failed to read Blob:", e);
        };
        reader.readAsText(rawData);
    } else {
        // טיפול במחרוזות רגילות
        handleMessageProcessing(rawData);
    }
}, [lastMessage, handleMessageProcessing]);

  // --- Category change handler (נשאר זהה) ---
  const handleCategoryChange = useCallback(
    (newCategory) => {
      setCategory(newCategory);
      setEntityFilter(""); 
      setWordFilter("");
      setFilterType("Category");

      if (readyState === ReadyState.OPEN) {
        const topicsToSubscribe = newCategory ? ["Politics", "Finance", "Science", "Culture", "Sport"] : ["Politics", "Finance", "Science", "Culture", "Sport"];
        sendMessage(JSON.stringify({ action: "subscribe", topics: topicsToSubscribe }));
      }
    },
    [readyState, sendMessage]
  );
  
  // --- Entity change handler (נשאר זהה) ---
  const handleEntityFilterChange = useCallback(
    (newEntity) => {
      setEntityFilter(newEntity);
      setCategory(""); 
      setWordFilter(""); 
      setFilterType("Entity");
    },
    []
  );

  // --- Auto-subscribe when ready (נשאר זהה) ---
  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      if (filterType === "Category") {
        handleCategoryChange(category);
      } else {
        sendMessage(JSON.stringify({ action: "subscribe", topics: ["Politics", "Finance", "Science", "Culture", "Sport"] }));
      }
    }
  }, [readyState, category, handleCategoryChange, filterType, sendMessage]);

  const connectionStatus = {
    [ReadyState.CONNECTING]: "מתחבר לשרת...",
    [ReadyState.OPEN]: null,
    [ReadyState.CLOSING]: "סוגר חיבור...",
    [ReadyState.CLOSED]: "החיבור נותק. מנסה להתחבר מחדש...",
    [ReadyState.UNINSTANTIATED]: "מאתחל...",
  }[readyState];

  // --- לוגיקת סינון משולבת (נשאר זהה) ---
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      
      if (filterType === "Category") {
        return category === "" || item.category === category;
      } 
      
      if (filterType === "Entity") {
        if (entityFilter === "") return true; 
        const hasEntity = item.ner_arr && item.ner_arr.some(nerItem => nerItem.entity === entityFilter);
        return hasEntity;
      }

      if (filterType === "Word" && wordFilter) {
          const targetWord = wordFilter.toLowerCase().trim();
          const hasSpecificWord = item.ner_arr && item.ner_arr.some(nerItem => 
              nerItem.word.toLowerCase().replace(/##/g, '').trim() === targetWord
          );
          return hasSpecificWord;
      }

      return true;
    });
  }, [items, filterType, category, entityFilter, wordFilter]);
  
  // 🚨 פונקציה לניווט והעברת ה-items כ-State
  const navigateToEntities = () => {
      navigate("/entities", { state: { articles: items } });
  };


  return (
  
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 border-b pb-4">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <h1 className="rtl text-2xl font-extrabold tracking-tight text-gray-900">
                Sham11 · חדשות עכשיו
              </h1>
            </div>
        </div>

        {/* 🚨 המיקום החדש: ככותרת נפרדת מעל ממשק הסינון */}
        <div className="mb-4 pt-2"> 
            <button 
               onClick={navigateToEntities} 
               className="text-sm font-semibold text-purple-600 hover:underline transition bg-transparent border-none p-0 cursor-pointer"
            >
               🔎 חקור ישויות (NER)
            </button>
        </div>


        {/* --- ממשק סינון מודולרי --- */}
        <div className="mt-4 flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center space-x-2 space-x-reverse">
            <span className="text-gray-600 whitespace-nowrap">סנן לפי:</span>
            <select
              className="rounded-lg border border-gray-300 p-2 text-sm"
              value={filterType === 'Word' ? 'Entity' : filterType} 
              onChange={(e) => {
                const newFilterType = e.target.value;
                setFilterType(newFilterType);
                setCategory(newFilterType === 'Category' ? category : "");
                setEntityFilter(newFilterType === 'Entity' ? entityFilter : "");
                setWordFilter(""); 
              }}
              dir="rtl"
            >
              <option value="Category">קטגוריה</option>
              <option value="Entity">ישות (סוג: PER, ORG)</option>
            </select>
          </div>
          
          {filterType === "Category" && (
            <CategoryPicker value={category} onChange={handleCategoryChange} />
          )}

          {filterType === "Entity" && (
            <select
              className="rounded-lg border border-gray-300 p-2 text-sm"
              value={entityFilter}
              onChange={(e) => handleEntityFilterChange(e.target.value)}
              dir="rtl"
            >
              <option value="">-- כל הישויות --</option>
              {NER_ENTITIES.map((entity) => (
                <option key={entity} value={entity}>
                  {entity} ({entity === "PER" ? "אדם" : entity === "ORG" ? "ארגון" : entity === "LOC" ? "מיקום" : "אחר"})
                </option>
              ))}
            </select>
          )}

          {/* הצגת כותרת הסינון WordFilter */}
          {filterType === "Word" && wordFilter && (
             <div className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold rtl">
                 מסנן: ישות ספציפית — **{wordFilter}**
                 <button onClick={() => setFilterType('Category')} className="mr-2 ml-2 text-xs text-purple-500 hover:text-purple-900">
                    (X נקה)
                 </button>
             </div>
          )}
          
        </div>
      </header>
      
      {connectionStatus && (
        <div className="rtl mb-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          {connectionStatus}
        </div>
      )}
      {error && (
        <div className="rtl mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {readyState === ReadyState.CONNECTING && items.length === 0 && !error && (
          <p className="col-span-full text-center text-gray-500">
            טוען חדשות...
          </p>
        )}

        {filteredItems.map((it, idx) => (
          <NewsCard key={it.id || idx} item={it} /> 
        ))}

        {readyState === ReadyState.OPEN &&
          filteredItems.length === 0 &&
          !error && (
            <p className="col-span-full text-center text-gray-500">
              אין ידיעות זמינות בסינון הנוכחי.
            </p>
          )}
      </section>
    </main>
  );
}