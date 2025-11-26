import React from "react";
import { Link } from "react-router-dom";
import { CLOUDINARY_ENTITY_MAP } from './EntityDefinitions'; 

export default function EntityCard({ word, entityType, count, imageUrl }) { // קבלת imageUrl
    
    const baseEntityData = CLOUDINARY_ENTITY_MAP[entityType] || CLOUDINARY_ENTITY_MAP.MISC;

    // הקישור מוביל לדף הבית עם סינון לפי מילה ספציפית
    return (
        <Link to={`/?filterType=Word&wordFilter=${encodeURIComponent(word)}`} className="block">
            <div className={`rounded-xl shadow-lg overflow-hidden transition-all duration-300 transform hover:scale-[1.03] hover:shadow-xl border-4 ${baseEntityData.color.replace('bg-', 'border-')}`}>
                
                {/* התמונה (מעל שם הישות) */}
                <div className="h-40 relative">
                     {imageUrl ? (
                        <img 
                            src={imageUrl} 
                            alt={word} 
                            // הקלאס הזה מאפשר לתמונה להופיע באופן מלא
                            className="w-full h-full object-cover transition-opacity duration-300" 
                            onError={(e) => {
                                e.target.onerror = null; 
                                e.target.style.display = 'none'; // מסתיר את התמונה השבורה
                            }}
                        />
                     ) : null}
                    
                    {/* רקע גיבוי/שכבת על לטקסט */}
                    <div className={`absolute inset-0 flex flex-col justify-end p-4 
                                    ${imageUrl ? 'bg-black bg-opacity-30' : baseEntityData.color}`}> 
                        <h2 className="text-xl font-bold text-white mb-1 leading-snug">
                            {word} 
                        </h2>
                        <p className="text-sm font-semibold text-gray-200">
                            {baseEntityData.name} ({entityType}) | מופיע {count} פעמים
                        </p>
                    </div>
                </div>
                
            </div>
        </Link>
    );
}