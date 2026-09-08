const input = document.querySelector(".input-section input");
const button = document.querySelector(".send-button");
const chatBox = document.querySelector(".chat-box");
const chatEndpoint = "https://zui-mark-1.onrender.com/chat";

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
        return "Hello, Boss. How can I help?";
    }

    return "I am running in local mode while the online backend reconnects. I can still save and show memories.";
}

async function sendMessage() {

    const message = input.value.trim();

    if (message === "") {
        return;
    }

    // Show user's message
    chatBox.innerHTML += `
        <div class="message user-message">
            <span class="sender">YOU</span>
            <p>${message}</p>
        </div>
    `;

    input.value = "";

    // Show thinking message
    const thinking = document.createElement("div");

    thinking.className = "message zui-message";

    thinking.innerHTML = `
        <span class="sender">ZUI</span>
        <p>ZUI is thinking...</p>
    `;

    chatBox.appendChild(thinking);

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

        thinking.innerHTML = `
            <span class="sender">ZUI</span>
            <p>${data.reply}</p>
        `;

    } catch (error) {

        console.error("ZUI CONNECTION ERROR:", error);

        thinking.innerHTML = `
            <span class="sender">ZUI</span>
            <p>${createLocalReply(message)}</p>
        `;
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