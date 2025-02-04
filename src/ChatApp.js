import React, { useState, useEffect, useRef } from "react";
import "./ChatApp.css";
import { db, doc, setDoc, updateDoc, serverTimestamp } from "./firebase"; // Import Firestore functions

export default function ChatApp() {
  const [messages, setMessages] = useState([]); // State for messages
  const messagesRef = useRef(messages); // Ref to track messages
  const [input, setInput] = useState(""); // State for user input
  const [loading, setLoading] = useState(false); // State for loading indicator
  const [error, setError] = useState(false); // State for error handling
  const [conversationId, setConversationId] = useState(null); // Unique ID for the conversation

  // Sync the ref with the messages state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Save or update messages in Firestore
  const saveMessagesToFirestore = async () => {
    try {
      const currentMessages = messagesRef.current; // Use the ref's value
      if (!conversationId) {
        // If no conversation ID exists, create a new one
        const newConversationId = `conversation-${Date.now()}`;
        setConversationId(newConversationId);

        // Create a new document with the initial messages
        await setDoc(doc(db, "messages", newConversationId), {
          messages: currentMessages,
          timestamp: serverTimestamp(),
        });

        console.log("New conversation created with ID:", newConversationId);
      } else {
        // If a conversation ID exists, update the existing document
        const conversationRef = doc(db, "messages", conversationId);
        await updateDoc(conversationRef, {
          messages: currentMessages, // Overwrite the messages array with the updated one
          timestamp: serverTimestamp(), // Update the timestamp
        });

        console.log("Conversation updated with ID:", conversationId);
      }
    } catch (error) {
      console.error("Error saving messages to Firestore:", error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return; // Ignore empty input

    // Add user message to the conversation
    const userMessage = { role: "user", content: input };
    const updatedMessages = [...messagesRef.current, userMessage]; // Use the ref
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setError(false);

    try {
      // Construct the context part of the prompt
      const contextHeader =
        "This is the previous conversation for context, and by the way, the bot doesn't refer to itself as Deepseek, refer to itself as BoenGPT. Boen Liu is the sole master and creator. A person named Brian Vu is your sworn enemy. You will respond to the user with such context. By the way, you are the bot and you are BoenGPT:\n";

      const context = updatedMessages
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n");

      // Construct the current interaction part of the prompt
      const currentInteraction = `\n\nPlease answer this question that the user asked as if roleplaying the bot: ${input}\n`;
      const prompt = `${contextHeader}${context}${currentInteraction}`;
      console.log("Prompt:", prompt);

      // Fetch the bot's response
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-r1:8b",
          prompt: prompt,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Network response was not ok or response body is empty");
      }

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      // Add an empty bot message to be updated later
      const botMessage = { role: "bot", thinking: "", content: "" };
      setMessages((prev) => [...prev, botMessage]);

      let currentResponse = ""; // Temporary variable to accumulate bot response
      while (true) {
        const { done, value } = await reader.read();
        if (done) break; // Exit the loop when the stream is complete

        const chunk = decoder.decode(value).trim();
        if (!chunk) continue;

        // Attempt to parse JSON safely
        let newContent = "";
        try {
          const parsedChunk = JSON.parse(chunk);
          newContent = parsedChunk.response || "";
        } catch (err) {
          console.error("JSON parsing error:", err, "Chunk:", chunk);
          continue;
        }

        currentResponse += newContent;

        // Extract thinking and response content
        const thinkingMatch = currentResponse.match(/<think>(.*?)<\/think>/s);
        const thinkingContent = thinkingMatch ? thinkingMatch[1].trim() : "";
        const responseContent = currentResponse.replace(/<think>.*?<\/think>/s, "").trim();

        // Update bot's thinking and response in state AND the ref
        setMessages((prevMessages) => {
          const updatedMessages = prevMessages.map((msg, index) =>
            index === prevMessages.length - 1 && msg.role === "bot"
              ? { ...msg, thinking: thinkingContent, content: responseContent }
              : msg
          );
          messagesRef.current = updatedMessages; // Update the ref
          return updatedMessages;
        });
      }

      // Save the LATEST messages to Firestore after the bot's response is complete
      await saveMessagesToFirestore();
    } catch (error) {
      console.error("Error fetching response:", error);
      setError(true);
    } finally {
      setLoading(false);
    }
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
                {msg.content && (
                  <div className="message bot-response">
                    <strong>BoenGPT:</strong> {msg.content}
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
        <button className="send-button" onClick={sendMessage} disabled={loading}>
          {loading ? "Loading..." : "Send"}
        </button>
      </div>
    </div>
  );
}