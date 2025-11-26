import { useNavigate, useParams, Link } from "react-router-dom";
import React, { useEffect, useState } from "react";

// *** 1. פונקציית עזר לטיפול ב-NER והדגשה ***
const HighlightedText = ({ text, nerArr }) => {
  if (!text) return null;
  if (!nerArr || nerArr.length === 0) return <>{text}</>;

  // מפת ישויות (מילה: ישות) לחיפוש מהיר
  const entityMap = {};
  nerArr.forEach(item => {
    // נשתמש ב-toLowerCase כדי להבטיח התאמה ללא קשר לאותיות גדולות/קטנות
    // ונחליף את '##' שה-NER Pipeline לפעמים משאיר
    const word = item.word.toLowerCase().replace(/##/g, '').trim(); 
    if (word) {
      // נשמור את סוג הישות וציון הביטחון
      entityMap[word] = { entity: item.entity, score: item.score };
    }
  });

  // פיצול הטקסט לפי מילים (כולל סימני פיסוק שצמודים למילה)
  // רג'קס שמפריד מילים על סמך רווחים ושומר על סימני פיסוק
  const parts = text.split(/(\s+)/); 

  return (
    <>
      {parts.map((part, index) => {
        // אם החלק הוא רווח, מחזירים אותו כפי שהוא
        if (/\s+/.test(part)) {
          return <span key={index}>{part}</span>;
        }

        // ניקוי המילה מסימני פיסוק כדי לחפש במפה, ושמירת סימני הפיסוק בצד
        const cleanWord = part.toLowerCase().replace(/[^a-z0-9]/g, '');
        const punctuation = part.replace(new RegExp(cleanWord, 'gi'), ''); 

        const entityData = entityMap[cleanWord];

        if (entityData) {
          let colorClass = "text-gray-800 bg-gray-200 p-1 rounded font-semibold"; // ברירת מחדל

          // הדגשת PER בכחול
          if (entityData.entity === "PER") {
            colorClass = "text-blue-700 bg-blue-100 p-1 rounded font-semibold";
          } 
          // הדגשת LOC (מיקום) בירוק (לדוגמה)
          else if (entityData.entity === "LOC") {
             colorClass = "text-green-700 bg-green-100 p-1 rounded font-semibold";
          }
          // הדגשת ORG (ארגון) בכתום (לדוגמה)
          else if (entityData.entity === "ORG") {
             colorClass = "text-orange-700 bg-orange-100 p-1 rounded font-semibold";
          }

          return (
            <React.Fragment key={index}>
              <span 
                className={colorClass}
                title={`Entity: ${entityData.entity} | Score: ${entityData.score.toFixed(4)}`}
              >
                {part.replace(punctuation, '')} 
              </span>
              {punctuation}
            </React.Fragment>
          );
        }

        // אם לא נמצאה ישות, מחזירים את החלק המקורי
        return <span key={index}>{part}</span>;
      })}
    </>
  );
};

// --- הקומפוננטה הראשית ---

export default function ArticlePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
        setError("Article ID not found in URL.");
        setLoading(false);
        return;
    }

    fetch(`http://localhost:8001/api/articles/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Article not found or API error.");
        return r.json();
      })
      .then((data) => {
        setArticle(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error("Fetch Error:", e);
        setError("שגיאה בשליפת הכתבה מהענן. (ודא ש-DBaaS עובד).");
        setLoading(false);
      });
  }, [id]);

  if (loading) return <p className="text-center p-6">טוען כתבה מהענן...</p>;
  if (error) return <p className="text-center p-6 text-red-500">{error}</p>;
  if (!article) return <p className="text-center p-6">הכתבה לא נמצאה.</p>;
  
  // הגדרת צבע הקטגוריה
  const categoryColor = article.category === "General" ? "bg-gray-500" : "bg-red-500";


  return (
    <div dir="ltr" className="container mx-auto p-6 max-w-4xl">
       <Link to="/" className="text-blue-600 hover:underline transition duration-150">
         ← Back to Home
       </Link>
      
      <div className="flex justify-between items-center my-6">
        <h1 className="text-3xl font-bold">{article.title}</h1>
        <span 
          className={`px-3 py-1 text-sm font-semibold text-white ${categoryColor} rounded-full shadow-md`}
        >
          {article.category}
        </span>
      </div>
      
      {article.image && <img className="w-full rounded-xl shadow-lg mb-6" src={article.image} alt={article.title} />}
      
      {/* גוף הכתבה - שימוש בקומפוננטת ההדגשה החדשה */}
      <div className="article-body prose prose-lg mt-8 text-gray-800 leading-relaxed border-t pt-4">
        <p className="lead text-xl">
          <HighlightedText 
            text={article.description || "No full content available."} 
            nerArr={article.ner_arr}
          />
        </p>
        
        <p className="text-gray-600 mt-8 text-sm">
          Source: <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{article.source}</a>
        </p>
      </div>
      
      {/* הצגת NER Data (למטרות דיבוג) */}
      {/* <div className="mt-12 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-xl font-semibold mb-3">NER Entities (Debug)</h3>
        <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(article.ner_arr, null, 2)}</pre>
      </div> */}
       <h1>Access Restricted: Why This Content Requires a Subscription</h1>

  <h2>Introduction: Understanding Paywalled Content</h2>
  <p>
    In today’s digital world, the internet gives us an endless flow of information, articles, videos, and educational materials. 
    However, not all content is freely available to the public. Many websites and online platforms restrict their content 
    behind what is known as a <strong>paywall</strong>—a system that requires users to pay or subscribe in order to access 
    certain materials. If you have reached this page and cannot view the full article, it means that the website’s content 
    is blocked because it requires payment to access. This model has become increasingly common across news websites, 
    streaming services, research databases, and educational platforms.
  </p>
  <p>
    The goal of this article is to explain why this happens, how paywalls work, and why content creators choose to protect 
    their work in this way. Understanding the logic behind paid content helps users appreciate the value of digital materials 
    and the importance of supporting creators, journalists, and educators who invest time and resources into quality production.
  </p>

  <h2>The Purpose Behind Paid Content</h2>
  <p>
    At first glance, it might seem unfair that information on the internet is not always free. Yet, behind every piece of 
    quality content—be it an investigative report, an online course, or a professional video—there are real costs. 
    Writers, editors, designers, researchers, and developers all contribute to the creation of meaningful content. 
    Hosting and maintaining servers, securing user data, and ensuring a pleasant browsing experience also require financial 
    investment. Without some form of revenue, it would be nearly impossible for organizations to sustain their work or 
    maintain high standards.
  </p>
  <p>
    Paywalls, therefore, act as a mechanism to ensure sustainability. By charging a subscription fee or a one-time payment, 
    platforms can continue producing accurate, verified, and creative content. In many cases, this model is also an alternative 
    to invasive advertising, which can compromise user privacy or distract from the viewing experience. Paid content helps 
    balance quality and independence, allowing creators to focus on value rather than clicks.
  </p>

  <h2>How Paywalls and Subscriptions Work</h2>
  <p>
    Technically, paywalls are implemented through web development tools that control access to specific sections of a website. 
    When you visit a page, the server checks whether your account has the proper credentials—such as an active subscription or 
    payment confirmation. If the system detects that you have not yet paid, the restricted material remains hidden, and a message 
    appears explaining that the content is blocked until payment is completed.
  </p>
  <p>
    There are several types of paywalls. A <em>hard paywall</em> completely prevents users from reading any part of the article 
    without paying, as seen in major newspapers like <strong>The Wall Street Journal</strong>. A <em>soft paywall</em>, on the 
    other hand, allows users to access a limited number of free articles before requiring a subscription. Some platforms also use 
    <em>freemium models</em>, offering basic features for free and premium options for paying users. These systems are designed 
    to strike a balance between accessibility and revenue generation.
  </p>

  <h2>Ethical and Economic Considerations</h2>
  <p>
    The discussion around paid content often raises ethical questions: Should knowledge and information be free for all, or is 
    it acceptable to charge for access? The answer is complex. On one hand, the free flow of information supports democracy, 
    education, and equality. On the other, producing reliable, in-depth, and well-researched content demands time, expertise, 
    and resources that need to be compensated.
  </p>
  <p>
    Economically, paywalls represent a fair trade between creators and consumers. Just as we pay for books, concerts, or software, 
    paying for digital content acknowledges the effort of those who produce it. It also encourages competition and innovation. 
    When users support ethical and transparent business models, they contribute to a healthier internet ecosystem—one that 
    rewards truth and creativity rather than clickbait and misinformation.
  </p>

  <h2>Conclusion: Supporting Quality in the Digital Era</h2>
  <p>
    In conclusion, the message “content blocked due to payment requirement” does not simply represent a barrier—it reflects a 
    sustainable system that enables creators to continue providing value. Paying for content is not just a transaction; it is 
    an act of support and appreciation for quality work. It ensures that journalists, teachers, artists, and developers can 
    continue to create without compromising integrity or relying on exploitative advertising.
  </p>
  <p>
    As the digital world continues to evolve, users are becoming more aware of the importance of fair compensation for 
    digital labor. By understanding why content is restricted and choosing to support reliable sources, readers become 
    active participants in the preservation of trustworthy, high-quality information online. Ultimately, paid content 
    is not the enemy of accessibility—it is a partner in building a better, more sustainable internet.
  </p>

  <hr/>
  <footer>
    <p><em>This article was created to explain why certain online materials are restricted and how subscription models work. 
    Thank you for respecting digital content creators and supporting fair access.</em></p>
  </footer>
    </div>
  );
}