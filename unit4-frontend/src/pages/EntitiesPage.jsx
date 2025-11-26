import React, { useEffect, useState } from "react";
import EntityCard from "../components/EntityCard";
import { useLocation } from "react-router-dom"; 

export default function EntitiesPage() {
    const location = useLocation();
    const articles = location.state?.articles || []; 

    const [wordCounts, setWordCounts] = useState({}); 
    const [loading, setLoading] = useState(true); 
    const [error, setError] = useState(null);

    useEffect(() => {
        if (articles.length === 0) {
            setError("אין נתונים זמינים. נסה לטעון את עמוד הבית תחילה.");
            setLoading(false);
            return;
        }

        // --- לוגיקת ספירת ישויות ---
        
        const counts = {};
        articles.forEach(article => {
            if (article.ner_arr) {
                article.ner_arr.forEach(nerItem => {
                    const word = nerItem.word.replace(/##/g, '').trim();
                    const entity = nerItem.entity;
                    const imageUrl = nerItem.image_url; 
                    
                    if (word && entity) {
                        const key = word.toLowerCase(); 
                        
                        if (counts[key]) {
                            counts[key].count += 1;
                        } else {
                            counts[key] = {
                                word: word,
                                entity: entity,
                                count: 1,
                                imageUrl: imageUrl
                            };
                        }
                    }
                });
            }
        });

        setWordCounts(counts);
        setLoading(false);
        
    }, [articles]); 

    // ממיר את האובייקט למערך עבור הצגה, וממיין לפי מספר הופעות
    const words = Object.values(wordCounts).sort((a, b) => b.count - a.count);

    if (loading) return <p className="text-center p-6 text-xl">מעבד ישויות...</p>;
    if (error) return <p className="text-center p-6 text-red-500">{error}</p>;
    if (words.length === 0) return <p className="text-center p-6">לא נמצאו ישויות מתאימות להצגה.</p>;


    return (
        <main className="mx-auto max-w-6xl px-4 py-6">
            <h1 className="rtl text-3xl font-extrabold tracking-tight text-gray-900 mb-8 border-b pb-3">
                🌎 חוקר ישויות (Words Explorer)
            </h1>

            <div className="rtl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {words.map((item) => (
                    <EntityCard 
                        key={item.word} 
                        word={item.word} 
                        entityType={item.entity} 
                        count={item.count} 
                        imageUrl={item.imageUrl} 
                    />
                ))}
            </div>
        </main>
    );
}