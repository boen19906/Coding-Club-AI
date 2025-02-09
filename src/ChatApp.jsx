import React, { useState, useEffect, useRef } from "react";
import "./ChatApp.css";
import { db, doc, setDoc, updateDoc, serverTimestamp } from "./firebase"; // Import Firestore functions
import OpenAI from "openai"; // Import OpenAI SDK
import VolumeOffIcon from '@mui/icons-material/VolumeOff'; // Mute icon
import VolumeUpIcon from '@mui/icons-material/VolumeUp'; // Unmute icon

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
  const [isMuted, setIsMuted] = useState(false); // State to track mute/unmute
  const audioRef = useRef(null); // Ref for the audio element
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [abortController, setAbortController] = useState(null); // State for AbortController
  const timeoutIdRef = useRef(null); // Ref to track the timeout ID

  // Ref for the messages container
  const messagesContainerRef = useRef(null);

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

  // Autoscroll to the bottom when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
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

        const controller = new AbortController();
        setAbortController(controller);

        // Set a timeout for the initial message
        timeoutIdRef.current = setTimeout(() => {
          controller.abort();
          setError(true);
          setLoading(false);
          alert("Server is busy. Please try again later.");
        }, 120000); // 120 seconds timeout

        try {
          // Construct the initial prompt
          const initialPrompt = `Yo, what's good HoodGPT? This is ${userName}, reppin' ${hood}. Them fools ${opps} better watch their backs. Introduce yourself (keep it under 50 words)`;

          // Fetch the bot's response using OpenAI SDK with streaming
          const stream = await openai.chat.completions.create({
            messages: [{ role: "user", content: initialPrompt }],
            model: "deepseek-chat", // Use the correct model name
            stream: true, // Enable streaming
          }, { signal: controller.signal });

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
          if (error.name === 'AbortError') {
            console.log('Request aborted due to timeout or user action');
          } else {
            console.error("Error fetching initial response:", error);
            setError(true);
          }
        } finally {
          clearTimeout(timeoutIdRef.current); // Clear the timeout
          setLoading(false);
          setAbortController(null);
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

    const controller = new AbortController();
    setAbortController(controller);

    // Set a timeout for the request
    timeoutIdRef.current = setTimeout(() => {
      controller.abort();
      setError(true);
      setLoading(false);
      alert("Server is busy. Please try again later.");
    }, 60000); // 10 seconds timeout

    try {
      // Construct the context part of the prompt
      const contextHeader =
        `Here is some context to give you about your roleplay. ${userName} is your (the bot's) sole master 
        and creator. The following are your sworn enemies: ${opps}. 
        You will respond to the user as if you are a Inner City hoodlum named HoodGPT, talk like a hoodlum, 
        act rude, brash, have a disregard for rules and comftorable with violent criminal activity. You like physical violence.
        Your job is a
        gangbanger. Again, roleplay as the hoodlum
        HoodGPT. Your hood (the place ur from) is ${hood}, 
        that's where u operate. You are having a conversation with ${userName} roleplaying as HoodGPT, the following is the recorded conversation
        so far:\n`;

      const context = updatedMessages
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n");

      // Construct the current interaction part of the prompt
      const currentInteraction = `\n\nPlease answer the user's reponse as if roleplaying the violent bot (HoodGPT, but don't act like a bot act like a human), keep it under 50 words and don't use quotes: ${input}\n`;
      const prompt = `${contextHeader}${context}${currentInteraction}`;
      console.log("Prompt:", prompt);

      // Fetch the bot's response using OpenAI SDK with streaming
      const stream = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "deepseek-chat", // Use the correct model name
        stream: true, // Enable streaming
      }, { signal: controller.signal });

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
      if (error.name === 'AbortError') {
        console.log('Request aborted due to timeout or user action');
      } else {
        console.error("Error fetching response:", error);
        setError(true);
      }
    } finally {
      clearTimeout(timeoutIdRef.current); // Clear the timeout
      setLoading(false);
      setAbortController(null);
    }
  };

  // Handle Enter key press to send the message
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      sendMessage();
    }
  };

  // Toggle mute/unmute
  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    // Mute/unmute all audio and video elements on the page
    const mediaElements = document.querySelectorAll("audio, video");
    mediaElements.forEach((element) => {
      element.muted = newMutedState;
    });

    // Optional: Mute/unmute sounds played through the Web Audio API
    if (window.AudioContext || window.webkitAudioContext) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (newMutedState) {
        audioContext.suspend(); // Suspend audio context (mute)
      } else {
        audioContext.resume(); // Resume audio context (unmute)
      }
    }
  };

  useEffect(() => {
    const playAudio = async () => {
      if (audioRef.current) {
        try {
          audioRef.current.volume = 0.1; // Set volume to 10%
          await audioRef.current.play();
          setShowPlayButton(false); // Hide play button if audio plays successfully
        } catch (error) {
          console.error("Auto-play failed:", error);
          setShowPlayButton(true); // Show play button if auto-play is blocked
        }
      }
    };
  
    playAudio();
  }, []);
  

  // Handle user interaction to play audio
  const handleInputFocus = () => {
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => {
          console.log("Audio started playing after input focus.");
        })
        .catch((error) => {
          console.error("Error playing audio:", error);
        });
    }
  };

  // Stop generating the response
  const stopGenerating = () => {
    if (abortController) {
      abortController.abort();
      setLoading(false);
      setAbortController(null);
    }
  };

  return (
    <div className="chat-container">
      {/* Mute/Unmute Button */}
      

      {/* Welcome message with GIF */}
      <div className="welcome-message">
        <button className="mute-button" onClick={toggleMute}>
          {isMuted ? (
            <VolumeOffIcon className="responsive-icon" />
          ) : (
            <VolumeUpIcon className="responsive-icon" />
          )}
        </button>
        <h1>🔫Welcome to HoodGPT!🔫</h1>
        <img src="/psycho.gif" alt="Psycho GIF" className="welcome-gif" />
      </div>

      {/* Input form for user name, opps, and hood */}
      {!chatStarted && (
        <div className="setup-form">
          <h2>Set Up Your Hood</h2>
          <form onSubmit={startChat}>
            <input
              type="text"
              placeholder="Street Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onFocus={handleInputFocus} // Trigger audio on focus
              required
            />
            <input
              type="text"
              placeholder="Drop the Opps List"
              value={opps}
              onChange={(e) => setOpps(e.target.value)}
              onFocus={handleInputFocus}
              required
            />
            <input
              type="text"
              placeholder="Your Hood"
              value={hood}
              onChange={(e) => setHood(e.target.value)}
              onFocus={handleInputFocus}
              required
            />
            <button type="submit">Start Chat</button>
          </form>
        </div>
      )}
       {/* Auto-playing audio */}
       <audio ref={audioRef} autoPlay loop>
        <source src="/hood.mp3" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>

      {/* Chat interface */}
      {chatStarted && (
        <>
          <div className="messages-container" ref={messagesContainerRef}>
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
            <button
            className={"send-button"}
            onClick={loading ? stopGenerating : sendMessage}
            disabled={!loading && !input.trim()}
            >
              {loading ? "Stop" : "Send"}
            </button>

          </div>
        </>
      )}
    </div>
  );
}