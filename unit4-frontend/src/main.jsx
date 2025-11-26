import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// ❤️ מחזירים את כל הנתיבים הנכונים ❤️
import Home from "./Home.jsx";
import ArticlePage from "./pages/ArticlePage.jsx";
import "./styles.css";
import EntitiesPage from "./pages/EntitiesPage.jsx";

createRoot(document.getElementById("root")).render(
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* ❤️ מחזירים את הראוט לעמוד הפנימי ❤️ */}
        <Route path="/article/:id" element={<ArticlePage />} />
        
        {/* 🚨 תיקון קריטי: הוספת הנתיב לדף חקר הישויות */}
        <Route path="/entities" element={<EntitiesPage />} /> 
        
      </Routes>
    </BrowserRouter>
);