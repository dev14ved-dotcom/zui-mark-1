const input = document.querySelector(".input-section input");
const button = document.querySelector(".send-button");
const chatBox = document.querySelector(".chat-box");
const chatEndpoint = "https://zui-mark-1.onrender.com/chat";
const settingsButton = document.querySelector(".controls button:last-child");
const themeSettings = document.querySelector(".theme-settings");
const themeOptions = document.querySelectorAll(".theme-option");
const sidebar = document.querySelector(".sidebar");
const sidebarToggle = document.querySelector(".sidebar-toggle");
const newChatButton = document.querySelector(".new-chat-button");
const conversationList = document.querySelector(".conversation-list");
const CONVERSATIONS_KEY = "zui-conversations";
const ACTIVE_CONVERSATION_KEY = "zui-active-conversation";
const welcomeMessage = "Hello. ZUI MARK 1 is online.";

function createConversation() {
    return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: "New conversation",
        messages: [{ role: "zui", text: welcomeMessage }]
    };
}

function loadConversations() {
    try {
        const saved = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) || "[]");
        return Array.isArray(saved) ? saved.filter(conversation =>
            conversation && typeof conversation.id === "string" &&
            Array.isArray(conversation.messages)
        ) : [];
    } catch (error) {
        console.warn("ZUI could not load saved conversations.", error);
        return [];
    }
}

function saveConversations() {
    try {
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
        localStorage.setItem(ACTIVE_CONVERSATION_KEY, activeConversationId);
    } catch (error) {
        console.warn("ZUI could not save conversations.", error);
    }
}

let conversations = loadConversations();
let activeConversationId = localStorage.getItem(ACTIVE_CONVERSATION_KEY);

if (!conversations.length) {
    conversations = [createConversation()];
}

if (!conversations.some(conversation => conversation.id === activeConversationId)) {
    activeConversationId = conversations[0].id;
}

saveConversations();

function getActiveConversation() {
    return conversations.find(conversation => conversation.id === activeConversationId);
}

function addMessage(role, text) {
    const message = document.createElement("div");
    message.className = `message ${role === "user" ? "user-message" : "zui-message"}`;
    message.innerHTML = `
        <span class="sender">${role === "user" ? "YOU" : "ZUI"}</span>
        <p>${formatChatText(text)}</p>
    `;
    chatBox.appendChild(message);
    return message;
}

function renderActiveConversation() {
    const conversation = getActiveConversation();
    chatBox.innerHTML = "";
    conversation.messages.forEach(message => addMessage(message.role, message.text));
    chatBox.scrollTop = chatBox.scrollHeight;
}

function renderConversationList() {
    conversationList.innerHTML = "";

    conversations.forEach(conversation => {
        const row = document.createElement("div");
        row.className = "conversation-row";

        const item = document.createElement("button");
        item.type = "button";
        item.className = "conversation-item";
        item.textContent = conversation.title;
        item.classList.toggle("is-active", conversation.id === activeConversationId);
        item.addEventListener("click", () => {
            activeConversationId = conversation.id;
            saveConversations();
            renderActiveConversation();
            renderConversationList();
            document.body.classList.remove("sidebar-open");
            sidebarToggle.setAttribute("aria-expanded", "false");
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "conversation-delete";
        deleteButton.textContent = "DELETE";
        deleteButton.setAttribute("aria-label", `Delete ${conversation.title}`);
        deleteButton.addEventListener("click", (event) => {
            event.stopPropagation();

            const indexToRemove = conversations.findIndex(item => item.id === conversation.id);
            if (indexToRemove === -1) {
                return;
            }

            const wasActive = conversation.id === activeConversationId;

            conversations.splice(indexToRemove, 1);

            if (!conversations.length) {
                const freshConversation = createConversation();
                conversations.push(freshConversation);
                activeConversationId = freshConversation.id;
            } else if (wasActive) {
                const nextIndex = Math.min(indexToRemove, conversations.length - 1);
                activeConversationId = conversations[nextIndex].id;
            }

            saveConversations();
            renderActiveConversation();
            renderConversationList();
        });

        row.appendChild(item);
        row.appendChild(deleteButton);
        conversationList.appendChild(row);
    });
}

function saveMessage(role, text, conversationId = activeConversationId) {
    const conversation = conversations.find(item => item.id === conversationId);

    if (!conversation) {
        return;
    }

    conversation.messages.push({ role, text });

    if (role === "user" && conversation.title === "New conversation") {
        const normalizedTitle = text.replace(/\s+/g, " ").trim();
        conversation.title = normalizedTitle.length > 42
            ? `${normalizedTitle.slice(0, 42)}...`
            : normalizedTitle;
    }

    saveConversations();
    renderConversationList();
}

newChatButton.addEventListener("click", () => {
    const conversation = createConversation();
    conversations.unshift(conversation);
    activeConversationId = conversation.id;
    saveConversations();
    renderActiveConversation();
    renderConversationList();
    input.focus();
});

sidebarToggle.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("sidebar-open");
    sidebarToggle.setAttribute("aria-expanded", String(isOpen));
});

function setTheme(theme) {
    const selectedTheme = theme === "light" ? "light" : "dark";

    document.documentElement.dataset.theme = selectedTheme;
    document.body.classList.toggle("light-mode", selectedTheme === "light");

    try {
        localStorage.setItem("zui-theme", selectedTheme);
    } catch (error) {
        console.warn("ZUI could not save the selected theme.", error);
    }

    themeOptions.forEach((option) => {
        const isSelected = option.dataset.theme === selectedTheme;
        option.classList.toggle("is-selected", isSelected);
        option.setAttribute("aria-pressed", String(isSelected));
    });
}

let savedTheme = "dark";

try {
    savedTheme = localStorage.getItem("zui-theme") || "dark";
} catch (error) {
    console.warn("ZUI could not read the saved theme.", error);
}

setTheme(savedTheme);

settingsButton.setAttribute("aria-expanded", "false");
settingsButton.setAttribute("aria-controls", "theme-settings");

settingsButton.addEventListener("click", () => {
    const isOpen = !themeSettings.hidden;
    themeSettings.hidden = isOpen;
    settingsButton.setAttribute("aria-expanded", String(!isOpen));
});

themeOptions.forEach((option) => {
    option.addEventListener("click", () => {
        setTheme(option.dataset.theme);
        themeSettings.hidden = true;
        settingsButton.setAttribute("aria-expanded", "false");
    });
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !themeSettings.hidden) {
        themeSettings.hidden = true;
        settingsButton.setAttribute("aria-expanded", "false");
        settingsButton.focus();
    }

    if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
        document.body.classList.remove("sidebar-open");
        sidebarToggle.setAttribute("aria-expanded", "false");
        sidebarToggle.focus();
    }
});

function formatChatText(text) {
    const safeText = String(text)
        // Some model/API responses escape Markdown characters. Convert those
        // markers back before escaping HTML and applying the allowed formatting.
        .replace(/\\\\([*_`])/g, "$1");

    return safeText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code>$1</code>")
        .replace(/\n/g, "<br>");
}

renderActiveConversation();
renderConversationList();

function createLocalReply(message) {

    const lowerMessage = message.toLowerCase();
    const memories = JSON.parse(
        localStorage.getItem("zui-memories") || "[]"
    );

    if (lowerMessage.startsWith("remember that ")) {

        const memory = message.substring(14).trim();

        if (memory && !memories.some(item => item.toLowerCase() === memory.toLowerCase())) {
            memories.push(memory);
            localStorage.setItem("zui-memories", JSON.stringify(memories));
            return "Got it. I've saved that in local memory.";
        }

        return "I already have that in local memory.";
    }

    if (lowerMessage === "what do you remember?" || lowerMessage === "show my memories") {
        if (memories.length === 0) {
            return "My local memory is currently empty.";
        }

        return "Here's what I remember:\n\n" +
            memories.map((item, index) => `${index + 1}. ${item}`).join("\n");
    }

    if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(lowerMessage)) {
        return "Hello, Boss! 😊 How can I help?";
    }

    return "I am running in local mode while the online backend reconnects. 😊 I can still save and show memories.";
}

async function sendMessage() {

    const message = input.value.trim();

    if (message === "") {
        return;
    }

    const conversationId = activeConversationId;

    // Show user's message
    addMessage("user", message);
    saveMessage("user", message, conversationId);

    input.value = "";

    // Show thinking message
    const thinking = addMessage("zui", "ZUI is thinking...");

    chatBox.scrollTop = chatBox.scrollHeight;

    try {

    const response = await fetch(chatEndpoint, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                message: message
            })
        });

        // Check HTTP status
        if (!response.ok) {
            throw new Error(
                `Server returned ${response.status}`
            );
        }

        const data = await response.json();

        const reply = typeof data.reply === "string" && data.reply.trim()
            ? data.reply
            : "I could not generate a complete reply. Please try again. 🙏";

        thinking.innerHTML = `
            <span class="sender">ZUI</span>
            <p>${formatChatText(reply)}</p>
        `;
        saveMessage("zui", reply, conversationId);

    } catch (error) {

        console.error("ZUI CONNECTION ERROR:", error);

        const fallbackReply = createLocalReply(message);

        thinking.innerHTML = `
            <span class="sender">ZUI</span>
            <p>${formatChatText(fallbackReply)}</p>
        `;
        saveMessage("zui", fallbackReply, conversationId);
    }

    chatBox.scrollTop = chatBox.scrollHeight;
}


// SEND BUTTON
button.addEventListener("click", sendMessage);


// ENTER KEY
input.addEventListener("keydown", function(event) {

    if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
    }

});
// ================================
// MICROPHONE
// ================================

const voiceButton = document.querySelector(".voice-button");

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

if (!SpeechRecognition) {

    voiceButton.addEventListener("click", function () {
        alert("Voice input is not supported in this browser.");
    });

} else {

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    voiceButton.addEventListener("click", function () {

        console.log("MIC BUTTON CLICKED");

        recognition.start();
    });

    recognition.onstart = function () {

        console.log("MICROPHONE STARTED");

        voiceButton.textContent = "🔴";
    };

    recognition.onresult = function (event) {

        const text =
            event.results[0][0].transcript;

        console.log("HEARD:", text);

        input.value = text;
    };

    recognition.onerror = function (event) {

        console.error("MIC ERROR:", event.error);

        voiceButton.textContent = "🎙";
    };

    recognition.onend = function () {

        console.log("MICROPHONE STOPPED");

        voiceButton.textContent = "🎙";
    };
}
