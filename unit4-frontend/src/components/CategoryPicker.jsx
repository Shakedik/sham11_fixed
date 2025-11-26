import React from "react";

const OPTIONS = [
    { label: "פוליטיקה", value: "Politics" },
    { label: "כלכלה", value: "Business" },
    { label: "מדע", value: "Science" },
    { label: "ספורט", value: "Sports" },
    { label: "תרבות", value: "Entertainment" },
    { label: "טכנולוגיה", value: "Technology" },
];

export default function CategoryPicker({ value, onChange }) {
    return (
        <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">קטגוריה:</label>
            <select
                className="rtl w-48 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">הכל</option>
                {OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
