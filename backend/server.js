require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = 3000;

const memoryFile = path.join(__dirname, "memory.json");

function loadMemories() {
    try {
        if (!fs.existsSync(memoryFile)) {
            return { memories: [] };
        }

        const data = fs.readFileSync(memoryFile, "utf8");
        const parsed = JSON.parse(data);

        if (!Array.isArray(parsed.memories)) {
            parsed.memories = [];
        }

        return parsed;
    } catch (error) {
        console.error("MEMORY LOAD ERROR:", error.message);
        return { memories: [] };
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

async function searchWeb(query) {
    const response = await axios.get(
        "https://serpapi.com/search.json",
        {
            params: {
                engine: "google",
                q: query,
                api_key: process.env.SERPAPI_KEY
            }
        }
    );

    return response.data;
}

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "..")));

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "..", "index.html")
    );
});

app.post("/chat", async (req, res) => {
    try {
        const message = req.body.message;

        if (!message || typeof message !== "string") {
            return res.json({
                reply: "Yes, Boss?"
            });
        }

        const lowerMessage = message.trim().toLowerCase();
        const memoryData = loadMemories();

        // REMEMBER
        if (lowerMessage.startsWith("remember that ")) {
            const memory = message
                .trim()
                .substring("remember that ".length)
                .trim();

            if (memory) {
                const alreadyExists = memoryData.memories.some(
                    item =>
                        item.toLowerCase() === memory.toLowerCase()
                );

                if (alreadyExists) {
                    return res.json({
                        reply: "I already remember that, Boss."
                    });
                }

                memoryData.memories.push(memory);
                saveMemories(memoryData);

                return res.json({
                    reply: "Got it, Boss. I've saved that in my memory."
                });
            }
        }

        // SHOW MEMORY
        if (
            lowerMessage === "what do you remember?" ||
            lowerMessage === "show my memories"
        ) {
            if (memoryData.memories.length === 0) {
                return res.json({
                    reply: "My memory is currently empty, Boss."
                });
            }

            const memoryList = memoryData.memories
                .map((item, index) => `${index + 1}. ${item}`)
                .join("\n");

            return res.json({
                reply: "Here's what I remember, Boss:\n\n" + memoryList
            });
        }

        // CLEAR MEMORY
        if (
            lowerMessage === "forget everything" ||
            lowerMessage === "clear my memories"
        ) {
            memoryData.memories = [];
            saveMemories(memoryData);

            return res.json({
                reply: "Done, Boss. I've cleared my memories."
            });
        }

        // SEARCH
        if (
            lowerMessage.startsWith("search ") ||
            lowerMessage.startsWith("search for ")
        ) {
            const query = message
                .replace(/^search\s+for\s+/i, "")
                .replace(/^search\s+/i, "")
                .trim();

            if (!query) {
                return res.json({
                    reply: "What should I search for, Boss?"
                });
            }

            try {
                const results = await searchWeb(query);

                if (
                    !results.organic_results ||
                    results.organic_results.length === 0
                ) {
                    return res.json({
                        reply: "I couldn't find any results, Boss."
                    });
                }

                const answer = results.organic_results
                    .slice(0, 5)
                    .map((result, index) => {
                        return (
                            `${index + 1}. ${result.title}\n` +
                            `${result.snippet || ""}`
                        );
                    })
                    .join("\n\n");

                return res.json({
                    reply: answer
                });

            } catch (error) {
                console.error(
                    "SERPAPI ERROR:",
                    error.response?.data || error.message
                );

                return res.status(500).json({
                    reply: "I couldn't access the web right now, Boss."
                });
            }
        }

        // TEMPORARY RESPONSE
        return res.json({
            reply:
                "My AI brain isn't connected yet, Boss. " +
                "Try saying: search Minecraft"
        });

    } catch (error) {
        console.error("ZUI SERVER ERROR:", error);

        return res.status(500).json({
            reply: "ZUI encountered a server error, Boss."
        });
    }
});

app.listen(PORT, () => {
    console.log(
        `ZUI backend running on http://localhost:${PORT}`
    );
});