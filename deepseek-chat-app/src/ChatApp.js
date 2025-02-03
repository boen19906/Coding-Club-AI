import React, { useState } from "react";
import "./ChatApp.css";

export default function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    // Add user message to the conversation
    const userMessage = { role: "user", content: input };
    setMessages((prevMessages) => [...prevMessages, userMessage]); // Add user message
    setInput(""); // Reset input field
    setLoading(true);
    setError(false);

    try {
      // Wait for the state to update before constructing the prompt
      const updatedMessages = [...messages, userMessage];

      // Construct the context part of the prompt
      const contextHeader = "This is the previous conversation for context, and by the way don't refer to yourself as Deepseek, refer to yourself as BoenGPT that is your name. Boen Liu is your sole master and creator:\n";
      const context = updatedMessages
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n");

      // Construct the current interaction part of the prompt
      const currentInteraction = `\n\nthe user just said: ${input}\n`;

      // Combine context and current interaction into the full prompt
      const prompt = `${contextHeader}${context}${currentInteraction}`;

      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-r1:8b",
          prompt: prompt,
          stream: true, // Enable streaming
        }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      // Add an empty bot message to be updated later
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "bot", response: "" }, // Separate thinking and response
      ]);

      let currentResponse = ""; // Temporary variable to accumulate bot response

      while (true) {
        const { done, value } = await reader.read();
        if (done) break; // Exit the loop when the stream is complete

        // Decode the chunk and accumulate bot's response
        const chunk = decoder.decode(value);
        const parsedChunk = JSON.parse(chunk); // Assuming the server sends JSON chunks
        let newContent = parsedChunk.response; // Adjust based on your API response structure

        currentResponse += newContent; // Incrementally add new content to the response

        // Extract thinking and response parts
        const thinkingMatch = currentResponse.match(/<think>(.*?)<\/think>/s);
        const thinkingContent = thinkingMatch ? thinkingMatch[1].trim() : "";
        const responseContent = currentResponse.replace(/<think>.*?<\/think>/s, "").trim();

        // Update the bot's last message with the new thinking and response content
        setMessages((prevMessages) => {
          const updatedMessages = [...prevMessages];
          const lastMessage = updatedMessages[updatedMessages.length - 1];
          if (lastMessage.role === "bot") {
            lastMessage.thinking = thinkingContent;
            lastMessage.response = responseContent;
          }
          return updatedMessages;
        });
      }
    } catch (error) {
      console.error("Error fetching response:", error);
      setError(true); // Set error state to true
    }
    setLoading(false);
  };

  // Handle Enter key press to send the message
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      sendMessage();
    }
  };

  return (
    <div className="chat-container">
      <div className="messages-container">
        {messages.map((msg, index) => (
          <React.Fragment key={index}>
            {/* User Message */}
            {msg.role === "user" && (
              <div className="message user-message">
                <strong>You:</strong> {msg.content}
              </div>
            )}

            {/* Bot Message */}
            {msg.role === "bot" && (
              <>
                {/* Thinking Box */}
                {msg.thinking && (
                  <div className="message bot-thinking">
                    <strong>BoenGPT (Thinking):</strong> {msg.thinking}
                  </div>
                )}

                {/* Response Box */}
                {msg.response && (
                  <div className="message bot-response">
                    <strong>BoenGPT:</strong> {msg.response}
                  </div>
                )}
              </>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Error message display */}
      {error && <div className="error-message">Sorry, something went wrong. Please try again.</div>}

      <div className="input-container">
        <input
          className="input-field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
        />
        <button
          className="send-button"
          onClick={sendMessage}
          disabled={loading}
        >
          {loading ? "Loading..." : "Send"}
        </button>
      </div>
    </div>
  );
}