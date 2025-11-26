// components/NewsCard.jsx (קוד מעודכן)

import React from "react";
import { Link } from "react-router-dom";

// פונקציית עזר להוצאת מילים ייחודיות של ישויות (עד 4 מילים)
const getUniqueEntityWords = (nerArr) => {
    if (!nerArr || !Array.isArray(nerArr)) return [];
    
    // אובייקט לשמירת הישויות, מונע כפילויות של מילים
    const uniqueWords = {}; 
    
    nerArr.forEach(item => {
        // מנקה את המילה וממיר לאותיות קטנות (להימנע מכפילויות כמו "Apple" ו-"apple")
        const cleanWord = item.word.replace(/##/g, '').trim(); 
        if (cleanWord && !uniqueWords[cleanWord.toLowerCase()]) {
             // שומרים את המילה המקורית, סוג הישות והצבע
             uniqueWords[cleanWord.toLowerCase()] = {
                 word: cleanWord, 
                 entity: item.entity,
                 ...getEntityTagStyle(item.entity)
             };
        }
    });

    // מחזירים מערך של ערכי האובייקט, חותכים ל-4 האלמנטים הראשונים
    return Object.values(uniqueWords).slice(0, 4);
};

// פונקציית עזר לתרגום ישויות וצבע (נשארת זהה)
const getEntityTagStyle = (entity) => {
    switch (entity) {
        case 'PER':
            return { label: 'אדם', color: 'bg-blue-200 text-blue-800' };
        case 'ORG':
            return { label: 'ארגון', color: 'bg-red-200 text-red-800' };
        case 'LOC':
            return { label: 'מיקום', color: 'bg-teal-200 text-teal-800' };
        default:
            return { label: entity, color: 'bg-gray-200 text-gray-700' };
    }
};

export default function NewsCard({ item }) {
  
  // *** שינוי: קורא את המילים הייחודיות ***
  const entityWords = getUniqueEntityWords(item.ner_arr); 
  
  const categoryColor = item.category === "General" ? "bg-gray-500" : "bg-red-500";
  const categoryTextColor = item.category === "General" ? "text-gray-500" : "text-red-500";


  return (
    <Link to={`/article/${item.id}`} className="block h-full">
        <div className="rtl bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full overflow-hidden border border-gray-100">
        
            {/* ... (חלק התמונה נשאר זהה) ... */}
            {item.image && (
                <div className="relative h-48 overflow-hidden">
                    <img 
                        src={item.image} 
                        alt={item.title} 
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                </div>
            )}
            
            <div className="p-5 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-3">
                    <span 
                        className={`text-xs font-semibold ${categoryTextColor}`}
                    >
                        {item.category}
                    </span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                        {item.source}
                    </span>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 mb-2 leading-snug">
                    {item.title}
                </h3>
                
                <p className="text-sm text-gray-600 mb-4 flex-grow line-clamp-3">
                    {item.description}
                </p>
                
                {/* --- תצוגת מילים מזוהות (החלק המעודכן) --- */}
                {entityWords.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                        {entityWords.map((tagData, index) => (
                                <span 
                                    key={index} 
                                    className={`px-3 py-1 text-xs font-medium rounded-full ${tagData.color}`}
                                    title={`ישות: ${tagData.label}`}
                                >
                                    {tagData.word} {/* *** מציג את המילה *** */}
                                </span>
                            ))}
                    </div>
                )}
                
            </div>
        </div>
    </Link>
  );
}