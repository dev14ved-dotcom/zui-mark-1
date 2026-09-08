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
                "ZUI: Searching web with SerpApi..."
            );

            try {

                const searchData =
                    await searchWeb(message);

                searchResults =
                    formatSearchResults(
                        searchData
                    );

                console.log(
                    "ZUI: SerpApi search complete."
                );

            } catch (searchError) {

                console.error(
                    "SERPAPI ERROR:",
                    searchError.message
                );

                // Don't completely kill ZUI
                // if search fails.
                searchResults = null;
            }
        }

        // ======================================
        // LOCAL RESPONSE
        // ======================================

        console.log(
            "ZUI: Creating local response..."
        );

        const answer =
            createLocalReply(
                message,
                memoryText,
                searchResults
            );

        console.log(
            "ZUI: Local response ready."
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