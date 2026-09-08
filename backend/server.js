require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

// ==========================================
// ZUI CONFIGURATION
// ==========================================

const SERP_API_URL = "https://serpapi.com/search.json";
const GNEWS_API_URL = "https://gnews.io/api/v4/search";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ==========================================
// MEMORY
// ==========================================

const memoryFile = path.join(__dirname, "memory.json");

function loadMemories() {
    try {
        if (!fs.existsSync(memoryFile)) {
            return { memories: [] };
        }

        const data = fs.readFileSync(memoryFile, "utf8");

        return JSON.parse(data);
    } catch (error) {
        console.error("MEMORY LOAD ERROR:", error.message);

        return {
            memories: []
        };
    }
}

function saveMemories(data) {
    try {
        fs.writeFileSync(
            memoryFile,
            JSON.stringify(data, null, 2)
        );
    } catch (error) {
        console.error("MEMORY SAVE ERROR:", error.message);
    }
}

// ==========================================
// EXPRESS
// ==========================================

app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost",
        "https://dev14ved-dotcom.github.io"
    ],
    credentials: true
}));
app.use(express.json());

// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {
    res.send("ZUI MARK 1 is online!");
});

app.get("/health", (req, res) => {
    res.json({
        ok: true,
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
        geminiModel: GEMINI_MODEL
    });
});

// ==========================================
// DETECT IF WEB SEARCH IS NEEDED
// ==========================================

function needsWebSearch(message) {

    const text = message.toLowerCase();

    const searchWords = [
        "search",
        "search for",
        "google",
        "latest",
        "news",
        "today",
        "current",
        "recent",
        "right now",
        "this week",
        "this month",
        "price",
        "weather",
        "score",
        "stock",
        "update",
        "updates",
        "who is",
        "what happened",
        "look up"
    ];

    return searchWords.some(word => text.includes(word));
}

// ==========================================
// SERPAPI SEARCH
// ==========================================

async function searchWeb(query) {

    if (!process.env.SERPAPI_KEY) {
        throw new Error("SERPAPI_KEY is missing.");
    }

    const response = await axios.get(SERP_API_URL, {
        params: {
            engine: "google",
            q: query,
            api_key: process.env.SERPAPI_KEY
        }
    });

    return response.data;
}

async function searchNews(query) {

    if (!process.env.GNEWS_API_KEY) {
        throw new Error("GNEWS_API_KEY is missing.");
    }

    const response = await axios.get(GNEWS_API_URL, {
        params: {
            q: query,
            lang: "en",
            max: 8,
            sortby: "publishedAt",
            apikey: process.env.GNEWS_API_KEY
        }
    });

    return response.data;
}

// ==========================================
// FORMAT SEARCH RESULTS
// ==========================================

function formatSearchResults(data) {

    let results = "";

    if (data.organic_results) {

        data.organic_results
            .slice(0, 8)
            .forEach((result, index) => {

                results += `
${index + 1}.
Title: ${result.title || "No title"}
Source: ${result.source || "Unknown"}
Snippet: ${result.snippet || "No snippet"}
Link: ${result.link || "No link"}
`;
            });
    }

    if (data.answer_box) {

        results += `

DIRECT ANSWER:
${JSON.stringify(data.answer_box, null, 2)}
`;
    }

    if (!results) {
        results = "No useful search results were found.";
    }

    return results;
}

function formatNewsResults(data) {

    if (!data.articles || data.articles.length === 0) {
        return "No useful news results were found.";
    }

    return data.articles
        .slice(0, 8)
        .map((article, index) => `
${index + 1}.
Title: ${article.title || "No title"}
Source: ${article.source?.name || "Unknown"}
Published: ${article.publishedAt || "Unknown"}
Snippet: ${article.description || "No snippet"}
Link: ${article.url || "No link"}`)
        .join("\n");
}

async function askGoogle(message, memory, searchResults = null) {

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
        throw new Error("Gemini is not configured. Add GEMINI_API_KEY to the backend environment.");
    }

    const context = [
        "You are ZUI MARK 1, a clear, friendly, direct assistant.",
        `Stored memories:\n${memory}`,
        searchResults ? `Web search results:\n${searchResults}` : "",
        "Do not claim to have searched the web unless search results are provided."
    ].filter(Boolean).join("\n\n");

    const requestBody = {
        contents: [{
            parts: [{
                text: `${context}\n\nUser question: ${message}`
            }]
        }],
        generationConfig: {
            temperature: 0.7
        }
    };

    const requestConfig = {
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
        },
        // Gemini 3.x can take longer than 30 seconds for a response.
        timeout: 120000
    };

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await axios.post(
            GEMINI_API_URL,
                requestBody,
                requestConfig
            );

            const answer = response.data?.candidates?.[0]?.content?.parts
                ?.map(part => part.text)
                .filter(Boolean)
                .join("\n");

            if (!answer) {
                throw new Error("Gemini returned no text response.");
            }

            return answer;
        } catch (error) {
            const errorMessage = error.response?.data?.error?.message || error.message;
            const retryable = error.response?.status === 429 ||
                error.response?.status === 503 ||
                /high demand|unavailable|overloaded/i.test(errorMessage);

            console.error("GOOGLE API ERROR:", errorMessage);

            if (!retryable || attempt === 3) {
                throw new Error(errorMessage);
            }

            const retryDelay = attempt * 2000;
            console.log(`ZUI: Gemini is busy; retrying in ${retryDelay / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
}

// ==========================================
// LOCAL RESPONSE
// ==========================================

function createLocalReply(message, memory, searchResults = null) {

    const lowerMessage = message.toLowerCase();

    if (searchResults) {
        return `I found these results for you:\n\n${searchResults}`;
    }

    if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(lowerMessage)) {
        return "Hello, Boss. How can I help?";
    }

    if (lowerMessage.includes("what do you know about me") && memory !== "No stored memories.") {
        return `Here is what I remember about you:\n\n${memory}`;
    }

    return "I am running in local mode without a model API. I can save and show memories, and I can search the web when you ask for current information.";
}

// ==========================================
// CHAT
// ==========================================

app.post("/chat", async (req, res) => {

    try {

        const message =
            typeof req.body.message === "string"
                ? req.body.message.trim()
                : "";

        if (!message) {

            return res.json({
                reply: "Yes, Boss?"
            });
        }

        const lowerMessage =
            message.toLowerCase();

        const memoryData =
            loadMemories();

        // ======================================
        // REMEMBER
        // ======================================

        if (lowerMessage.startsWith("remember that ")) {

            const memory =
                message
                    .substring(14)
                    .trim();

            if (memory) {

                // Prevent exact duplicates
                const alreadyExists =
                    memoryData.memories.some(
                        item =>
                            item.toLowerCase() ===
                            memory.toLowerCase()
                    );

                if (!alreadyExists) {

                    memoryData.memories.push(memory);

                    saveMemories(memoryData);

                    return res.json({
                        reply:
                            "Got it. I've saved that in my memory."
                    });
                }

                return res.json({
                    reply:
                        "I already have that in my memory."
                });
            }
        }

        // ======================================
        // SHOW MEMORY
        // ======================================

        if (
            lowerMessage === "what do you remember?" ||
            lowerMessage === "show my memories"
        ) {

            if (
                memoryData.memories.length === 0
            ) {

                return res.json({
                    reply:
                        "My memory is currently empty."
                });
            }

            const memoryList =
                memoryData.memories
                    .map(
                        (item, index) =>
                            `${index + 1}. ${item}`
                    )
                    .join("\n");

            return res.json({
                reply:
                    "Here's what I remember:\n\n" +
                    memoryList
            });
        }

        // ======================================
        // MEMORY CONTEXT
        // ======================================

        const memoryText =
            memoryData.memories.length > 0
                ? memoryData.memories
                    .map(
                        (item, index) =>
                            `${index + 1}. ${item}`
                    )
                    .join("\n")
                : "No stored memories.";

        // ======================================
        // WEB SEARCH
        // ======================================

        let searchResults = null;

        if (needsWebSearch(message)) {

            console.log(
                "ZUI: Searching for current information..."
            );

            try {

                const isNewsQuery =
                    /\b(news|latest|headlines|breaking|current events)\b/i.test(message);

                const searchData = isNewsQuery
                    ? await searchNews(message)
                    : await searchWeb(message);

                searchResults =
                    isNewsQuery
                        ? formatNewsResults(searchData)
                        : formatSearchResults(searchData);

                console.log(
                    `ZUI: ${isNewsQuery ? "GNews" : "SerpApi"} search complete.`
                );

            } catch (searchError) {

                console.error(
                    "SEARCH PROVIDER ERROR:",
                    searchError.message
                );

                if (isNewsQuery && process.env.SERPAPI_KEY) {
                    try {
                        const fallbackData = await searchWeb(message);
                        searchResults = formatSearchResults(fallbackData);
                    } catch (fallbackError) {
                        console.error("SEARCH FALLBACK ERROR:", fallbackError.message);
                    }
                }
            }
        }

        // ======================================
        // GOOGLE RESPONSE WITH LOCAL FALLBACK
        // ======================================

        console.log(
            "ZUI: Creating response..."
        );

        let answer;

        try {
            answer = await askGoogle(message, memoryText, searchResults);
        } catch (modelError) {
            console.error("GEMINI FALLBACK:", modelError.message);
            answer = createLocalReply(message, memoryText, searchResults);
        }

        console.log(
            "ZUI: Response ready."
        );

        res.json({
            reply: answer
        });

    } catch (error) {

        console.error(
            "ZUI ERROR:",
            error.response?.data ||
            error.message
        );

        res.status(500).json({
            reply:
                "ZUI encountered an error while thinking."
        });
    }
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {

    console.log(
        `ZUI backend running on port ${PORT}`
    );

});
