import React, { useState, useEffect, useRef } from "react";
import "./ChatApp.css";
import { db, doc, setDoc, updateDoc, serverTimestamp } from "./firebase"; // Import Firestore functions
import OpenAI from "openai"; // Import OpenAI SDK

export default function ChatApp() {
  const [messages, setMessages] = useState([]); // State for messages
  const messagesRef = useRef(messages); // Ref to track messages
  const [input, setInput] = useState(""); // State for user input
  const [loading, setLoading] = useState(false); // State for loading indicator
  const [error, setError] = useState(false); // State for error handling
  const [conversationId, setConversationId] = useState(null); // Unique ID for the conversation
  const [userName, setUserName] = useState(""); // State for user's name
  const [opps, setOpps] = useState(""); // State for list of opps
  const [hood, setHood] = useState(""); // State for hood name
  const [chatStarted, setChatStarted] = useState(false); // State to track if chat has started

  // Initialize OpenAI client with DeepSeek's API
  const openai = new OpenAI({
    baseURL: "https://api.deepseek.com", // DeepSeek's API endpoint
    apiKey: "sk-2fe6222bedf54239871cf7f3946d1fa7", // Your DeepSeek API key
    dangerouslyAllowBrowser: true, // Allow browser usage (required for client-side apps)
  });

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

  // Handle form submission to start the chat
  const startChat = (e) => {
    e.preventDefault();
    if (userName && opps && hood) {
      setChatStarted(true);
    } else {
      alert("Please fill out all fields before starting the chat.");
    }
  };

  // Send an initial message from the bot when the chat starts
  useEffect(() => {
    if (chatStarted) {
      const sendInitialMessage = async () => {
        setLoading(true);
        setError(false);

        try {
          // Construct the initial prompt
          const initialPrompt = `Yo, what's good? This is HoodGPT, reppin' ${hood}. You the boss, ${userName}, and I'm here to handle business. Them fools ${opps} better watch their backs. What you need, fam?`;

          // Fetch the bot's response using OpenAI SDK with streaming
          const stream = await openai.chat.completions.create({
            messages: [{ role: "user", content: initialPrompt }],
            model: "deepseek-chat", // Use the correct model name
            stream: true, // Enable streaming
          });

          // Add an empty bot message to be updated later
          const botMessage = { role: "bot", content: "" };
          setMessages([botMessage]);

          // Process the streamed response
          let fullResponse = "";
          for await (const chunk of stream) {
            const chunkContent = chunk.choices[0]?.delta?.content || "";
            fullResponse += chunkContent;

            // Update the bot's response in real-time
            setMessages((prevMessages) => {
              const updatedMessages = prevMessages.map((msg, index) =>
                index === prevMessages.length - 1 && msg.role === "bot"
                  ? { ...msg, content: fullResponse }
                  : msg
              );
              messagesRef.current = updatedMessages; // Update the ref
              return updatedMessages;
            });
          }

          // Save the updated messages to Firestore after the stream is complete
          await saveMessagesToFirestore();
        } catch (error) {
          console.error("Error fetching initial response:", error);
          setError(true);
        } finally {
          setLoading(false);
        }
      };

      sendInitialMessage();
    }
  }, [chatStarted]);

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
        `This is the previous conversation for context, and by the way, the bot doesn't 
        refer to itself as Deepseek, refer to itself as HoodGPT. ${userName} is the sole master 
        and creator. People named ${opps} are your sworn enemies. 
        You will respond to the user as if you are a Inner City hoodlum, talk like a hoodlum, 
        HoodGPT is a hoodlum. Be rude, roleplay as a rude hoodlum. Your hood is ${hood}, 
        that's where u operate. By the way, you are the bot 
        and you are HoodGPT:\n`;

      const context = updatedMessages
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n");

      // Construct the current interaction part of the prompt
      const currentInteraction = `\n\nPlease answer this question that the user asked as if roleplaying the bot: ${input}\n`;
      const prompt = `${contextHeader}${context}${currentInteraction}`;
      console.log("Prompt:", prompt);

      // Fetch the bot's response using OpenAI SDK with streaming
      const stream = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "deepseek-chat", // Use the correct model name
        stream: true, // Enable streaming
      });

      // Add an empty bot message to be updated later
      const botMessage = { role: "bot", content: "" };
      setMessages((prev) => [...prev, botMessage]);

      // Process the streamed response
      let fullResponse = "";
      for await (const chunk of stream) {
        const chunkContent = chunk.choices[0]?.delta?.content || "";
        fullResponse += chunkContent;

        // Update the bot's response in real-time
        setMessages((prevMessages) => {
          const updatedMessages = prevMessages.map((msg, index) =>
            index === prevMessages.length - 1 && msg.role === "bot"
              ? { ...msg, content: fullResponse }
              : msg
          );
          messagesRef.current = updatedMessages; // Update the ref
          return updatedMessages;
        });
      }

      // Save the updated messages to Firestore after the stream is complete
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
      {/* Welcome message with GIF */}
      <div className="welcome-message">
        <h1>Welcome to HoodGPT!</h1>
        <img src="/psycho.gif" alt="Psycho GIF" className="welcome-gif" />
      </div>

      {/* Input form for user name, opps, and hood */}
      {!chatStarted && (
        <div className="setup-form">
          <h2>Set Up Your Hood</h2>
          <form onSubmit={startChat}>
            <input
              type="text"
              placeholder="What's Your Street Name?"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="List Your Motherfuckin Opps (comma-separated)"
              value={opps}
              onChange={(e) => setOpps(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="What's Your Hood"
              value={hood}
              onChange={(e) => setHood(e.target.value)}
              required
            />
            <button type="submit">Start Chat</button>
          </form>
        </div>
      )}

      {/* Chat interface */}
      {chatStarted && (
        <>
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
                  <div className="message bot-message">
                    <strong>HoodGPT:</strong> {msg.content}
                  </div>
                )}
              </React.Fragment>
            ))}
            {/* Loading spinner */}
            {loading && (
              <div className="loading-spinner">
                <div className="spinner"></div>
              </div>
            )}
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
        </>
      )}
    </div>
  );
}