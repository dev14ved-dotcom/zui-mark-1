const input = document.querySelector(".input-section input");
const button = document.querySelector(".send-button");
const chatBox = document.querySelector(".chat-box");

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

        const response = await fetch("http://localhost:3000/chat", {
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
            <p>Connection to ZUI's core was lost.</p>
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