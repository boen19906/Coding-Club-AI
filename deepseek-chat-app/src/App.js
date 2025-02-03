// App.js
import React from 'react';
import ChatApp from './ChatApp';  // Correctly import ChatApp

function App() {
  return (
    <div className="App">
      <h1>Welcome to BoenGPT!</h1>
      <ChatApp />  {/* Render the ChatApp component */}
    </div>
  );
}

export default App;
