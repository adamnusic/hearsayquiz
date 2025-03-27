/** @typedef {import('../src/message.ts').DevvitSystemMessage} DevvitSystemMessage */
/** @typedef {import('../src/message.ts').WebViewMessage} WebViewMessage */

/**
 * Hear Say!? Game
 * A game where players guess which celebrity said a quote.
 */

// ===== Game State =====
let gameState = {
  username: 'Guest',
  score: 0,
  currentCategory: null,
  currentQuote: null,
  selectedCelebrity: null,
  timerInterval: null,
  timerDuration: 20,
  timeRemaining: 20,
  isPlaying: false,
  leaderboard: [], // Array to store leaderboard data
  playedCategories: [], // Keep track of which categories have been played
  lastPlayedCategory: null, // Track the last played category
};

// ===== Audio Context =====
let audioContext = null;
let countdownTicker = null; // Controller for the countdown ticking sound

// ===== DOM Elements =====
const usernameElement = document.getElementById('username');
const scoreElement = document.getElementById('score');
const gamePlayScreen = document.getElementById('game-play');
const gameResultScreen = document.getElementById('game-result');
const categorySelectScreen = document.getElementById('category-select');
const leaderboardScreen = document.getElementById('leaderboard-screen');
const currentCategoryElement = document.getElementById('current-category');
const quoteTextElement = document.getElementById('quote-text');
const timerBarElement = document.getElementById('timer-bar');
const timerTextElement = document.getElementById('timer-text');
const celebritiesContainer = document.getElementById('celebrities-container');
const resultMessageElement = document.getElementById('result-message');
const correctCelebrityElement = document.getElementById('correct-celebrity');
const selectedCelebrityElement = document.getElementById('selected-celebrity');
const pointsEarnedElement = document.getElementById('points-earned');
const playAgainButton = document.getElementById('play-again');
const nextCategoryButton = document.getElementById('next-category');
const showLeaderboardButton = document.getElementById('show-leaderboard');
const backToCategoriesButton = document.getElementById('back-to-categories');
const leaderboardEntriesContainer = document.getElementById('leaderboard-entries');
const quoteAudio = document.getElementById('quote-audio');
const correctAudio = document.getElementById('correct-audio');
const incorrectAudio = document.getElementById('incorrect-audio');

// ===== Communication with Devvit =====
// Listen for messages from the blocks view.
function setupMessageListener() {
  console.log('Setting up message listener');
  window.logDiagnostic('Setting up message listener');
  
  // Create a new message listener
  const messageListener = (event) => {
    console.log('Received event:', event);
    
    // Ensure the message is from Devvit
    if (event.data?.type !== 'devvit-message') {
      console.log('Not a devvit message, ignoring');
      return;
    }

    const message = event.data.message;
    console.log('Processing devvit message:', message);
    handleDevvitMessage(message);
  };

  // Add the message listener
  window.addEventListener('message', messageListener);
  console.log('Message listener added');
  window.logDiagnostic('Message listener added');
  
  // Notify the blocks view that we're ready
  console.log('Sending webViewReady message');
  window.logDiagnostic('Sending webViewReady message');
  
  sendMessage({ type: 'webViewReady' });
  
  // Don't automatically request game data here - wait for START GAME button click
  window.logDiagnostic('Waiting for START GAME button click to request game data');
  
  // Initialize status tracker for game data
  window.gameDataRequested = false;
}

// Send a message to the blocks view
function sendMessage(message) {
  console.log('Sending message to Devvit:', message);
  try {
    if (!window.parent) {
      console.error('Cannot access window.parent');
      window.logDiagnostic('ERROR: Cannot access window.parent');
      return false;
    }
    
    window.parent.postMessage({ message }, '*');
    console.log('Message sent successfully');
    window.logDiagnostic(`Message sent: ${message.type}`);
    return true;
  } catch (err) {
    console.error('Error sending message:', err);
    window.logDiagnostic(`ERROR sending message: ${err.message}`);
    
    // Schedule a retry
    setTimeout(() => {
      console.log('Retrying message send:', message);
      window.logDiagnostic(`Retrying message: ${message.type}`);
      try {
        window.parent.postMessage({ message }, '*');
        console.log('Retry message sent successfully');
        window.logDiagnostic(`Retry message sent: ${message.type}`);
      } catch (retryErr) {
        console.error('Retry also failed:', retryErr);
        window.logDiagnostic(`Retry also failed: ${retryErr.message}`);
      }
    }, 1000);
    
    return false;
  }
}

// Handle messages from the blocks view
function handleDevvitMessage(message) {
  console.log('Received message from Devvit:', message);
  window.logDiagnostic(`⬇️ ${message.type}`);
  
  switch (message.type) {
    case 'initialData':
      gameState.username = message.data.username;
      gameState.score = message.data.currentCounter;
      
      // Check if there's leaderboard data
      if (message.data.leaderboard) {
        gameState.leaderboard = message.data.leaderboard;
        updateLeaderboard();
      }
      
      // Update UI with the initial data
      usernameElement.textContent = gameState.username;
      scoreElement.textContent = gameState.score;
      console.log('Updated initial data:', gameState.username, gameState.score);
      window.logDiagnostic(`Updated player: ${gameState.username}, score: ${gameState.score}`);
      
      // Store the data but don't request game data yet - wait for START GAME button
      window.gameDataRequested = false;
      window.logDiagnostic('Waiting for user to click START GAME button');
      
      // DO NOT auto-load test data, even if explicitly requested
      // Just keep the loading screen visible with the START GAME button
      break;
      
    case 'gameData':
      console.log('Received game data:', message.data);
      window.logDiagnostic(`Game data for "${message.data.category}" received`);
      
      // Log detailed information about the received data
      if (message.data && message.data.quoteData) {
        console.log('Quote text:', message.data.quoteData.quote);
        console.log('Correct celebrity:', message.data.quoteData.correctCelebrity);
        console.log('Celebrities array:', message.data.quoteData.celebrities);
        console.log('Audio clips:', Object.keys(message.data.quoteData.audioClips || {}));
        
        // Check if audio clips use asset URLs
        const audioSample = Object.values(message.data.quoteData.audioClips || {})[0];
        if (audioSample) {
          console.log('Audio URL sample:', audioSample);
          window.logDiagnostic(`Audio URL: ${audioSample.substring(0, 30)}...`);
        } else {
          console.error('No audio clips found in quote data');
          window.logDiagnostic('ERROR: No audio clips in quote data');
        }
      } else {
        console.error('Invalid or missing quote data structure');
        window.logDiagnostic('ERROR: Invalid quote data structure');
      }
      
      // Make sure we have valid data before proceeding
      if (!message.data || !message.data.category || !message.data.quoteData) {
        console.error('Invalid game data received!');
        window.logDiagnostic('ERROR: Invalid game data structure');
        
        // Show an error message on the screen
        const errorMsg = document.createElement('div');
        errorMsg.style.color = 'red';
        errorMsg.style.padding = '20px';
        errorMsg.style.textAlign = 'center';
        errorMsg.innerHTML = `<strong>Error:</strong> Invalid game data received!<br>
          <button onclick="window.testReceiveGameData()" style="margin-top: 10px; padding: 5px 10px;">
            Load Test Data
          </button>`;
        
        if (celebritiesContainer) {
          celebritiesContainer.innerHTML = '';
          celebritiesContainer.appendChild(errorMsg);
        }
        
        return;
      }
      
      // Refresh DOM references to ensure we have all the elements we need
      refreshDOMReferences();
      
      gameState.currentCategory = message.data.category;
      gameState.currentQuote = message.data.quoteData;
      gameState.lastPlayedCategory = message.data.category;
      
      // Add category to played categories if not already there
      if (!gameState.playedCategories.includes(message.data.category)) {
        gameState.playedCategories.push(message.data.category);
      }
      
      // Remove the loading indicator if present - game can now start
      const loadingIndicator = document.getElementById('initial-loading-indicator');
      if (loadingIndicator) {
        loadingIndicator.remove();
        window.logDiagnostic("Removed loading indicator in gameData handler");
      }
      
      // Start the game with the received data
      window.logDiagnostic('Starting game with received data');
      startGame(message.data.category, message.data.quoteData);
      break;
    
    case 'leaderboardData':
      if (message.data && Array.isArray(message.data)) {
        gameState.leaderboard = message.data;
        updateLeaderboard();
        // Show the leaderboard screen if that's where the data was requested from
        if (leaderboardScreen.classList.contains('active')) {
          showScreen(leaderboardScreen);
        }
      }
      break;
      
    default:
      console.log('Unknown message type:', message.type);
      window.logDiagnostic(`Unknown message type: ${message.type}`);
  }
  
  // Make sure background is visible
  ensureBackgroundVisible();
}

// ===== Game Screens =====
// Show a specific game screen
function showScreen(screen) {
  window.logDiagnostic(`Showing screen: ${screen.id}`);
  
  // Make sure we have the screen element
  if (!screen || !screen.classList) {
    console.error('Invalid screen element:', screen);
    window.logDiagnostic(`ERROR: Invalid screen element: ${screen?.id || 'undefined'}`);
    return;
  }
  
  try {
    // If we have the ID, use our improved showGameScreen function
    if (screen.id) {
      return showGameScreen(screen.id);
    }
    
    // Get references to all screens
    const allScreens = [
      gamePlayScreen, 
      gameResultScreen, 
      categorySelectScreen, 
      leaderboardScreen
    ];
    
    // Hide all screens
    allScreens.forEach(s => {
      if (s && s.classList) {
        s.classList.remove('active');
        s.style.display = 'none';
      }
    });
    
    // Show the requested screen
    screen.classList.add('active');
    screen.style.display = 'flex';
    
    // Special handling for category select screen
    if (screen.id === 'category-select') {
      // Make sure category buttons are properly set up if showing this screen
      setupCategoryButtons();
    }
    
    // Special handling for game result screen
    if (screen.id === 'game-result') {
      // Make sure the result screen is properly visible and buttons are styled correctly
      prepareResultScreen();
      
      // Ensure buttons have event listeners
      const playAgainButton = document.getElementById('play-again');
      const nextCategoryButton = document.getElementById('next-category');
      
      // Check if the event listeners need to be re-added
      if (playAgainButton && !playAgainButton._hasListeners) {
        playAgainButton.addEventListener('click', () => {
          window.logDiagnostic("Play Again button clicked from result screen");
          sendMessage({
            type: 'playAgain',
            data: {
              category: gameState.lastPlayedCategory
            }
          });
        });
        
        // Mark that we've added listeners to avoid duplicates
        playAgainButton._hasListeners = true;
      }
      
      if (nextCategoryButton && !nextCategoryButton._hasListeners) {
        nextCategoryButton.addEventListener('click', () => {
          window.logDiagnostic("Next Category button clicked from result screen");
          
          // Refresh DOM references first to ensure we have everything
          refreshDOMReferences();
          
          // Show the category selection screen
          showScreen(categorySelectScreen || document.getElementById('category-select'));
        });
        
        // Mark that we've added listeners to avoid duplicates
        nextCategoryButton._hasListeners = true;
      }
    }
    
    // For game-play screen, apply our optimizations
    if (screen.id === 'game-play') {
      optimizeGamePlayLayout();
      ensureGameElementsVisible();
      window.logDiagnostic("Applied optimizations to game-play screen");
    }
    
    // Log which screen is active
    console.log('Active screen:', screen.id);
    window.logDiagnostic(`Screen changed to: ${screen.id}`);
    
    // Ensure background is visible in Devvit blocks
    ensureBackgroundVisible();
    
    return true;
    } catch (error) {
    console.error('Error in showScreen:', error);
    window.logDiagnostic(`ERROR in showScreen: ${error.message}`);
    
    // Try direct DOM method as fallback
    try {
      // If we have the ID, try the new function as a fallback
      if (screen.id) {
        return showGameScreen(screen.id);
      }
      
      // Hide all screens by ID
      document.querySelectorAll('.game-screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
      });
      
      // Show requested screen by direct DOM reference
      screen.classList.add('active');
      screen.style.display = 'flex';
      
      // Special handling for category select screen
      if (screen.id === 'category-select') {
        setupCategoryButtons();
      }
      
      // Special handling for game result screen as fallback
      if (screen.id === 'game-result') {
        // Try to highlight buttons in case prepareResultScreen can't be called
        const playAgainButton = document.getElementById('play-again');
        const nextCategoryButton = document.getElementById('next-category');
        
        if (playAgainButton) {
          playAgainButton.style.backgroundColor = '#121212';
          playAgainButton.style.color = 'white';
          playAgainButton.style.border = '3px solid #F5F834';
          playAgainButton.style.display = 'block';
          playAgainButton.style.margin = '10px auto';
          playAgainButton.style.padding = '10px 15px';
          playAgainButton.style.zIndex = '100';
        }
        
        if (nextCategoryButton) {
          nextCategoryButton.style.backgroundColor = '#121212';
          nextCategoryButton.style.color = 'white';
          nextCategoryButton.style.border = '3px solid #F5F834';
          nextCategoryButton.style.display = 'block';
          nextCategoryButton.style.margin = '10px auto';
          nextCategoryButton.style.padding = '10px 15px';
          nextCategoryButton.style.zIndex = '100';
        }
      }
      
      // For game-play screen, apply our optimizations
      if (screen.id === 'game-play') {
        optimizeGamePlayLayout();
        ensureGameElementsVisible();
        window.logDiagnostic("Applied optimizations to game-play screen (fallback)");
      }
      
      window.logDiagnostic(`Screen ${screen.id} shown using DOM fallback`);
      
      // Ensure background is visible in Devvit blocks
      ensureBackgroundVisible();
      
      return true;
    } catch (fallbackError) {
      window.logDiagnostic(`CRITICAL ERROR: Failed to show screen: ${fallbackError.message}`);
      return false;
    }
  }
}

// Update the leaderboard with current data
function updateLeaderboard() {
  // Clear existing entries
  leaderboardEntriesContainer.innerHTML = '';
  
  // Create a sorted copy of the leaderboard array
  const sortedLeaderboard = [...gameState.leaderboard].sort((a, b) => b.score - a.score);
  
  // Add entries to the leaderboard
  sortedLeaderboard.forEach((entry, index) => {
    const rank = index + 1;
    const isCurrentUser = entry.username === gameState.username;
    
    const leaderboardItem = document.createElement('div');
    leaderboardItem.className = `leaderboard-item ${isCurrentUser ? 'current-user' : ''}`;
    
    const rankSpan = document.createElement('span');
    rankSpan.className = 'rank';
    rankSpan.textContent = `${rank}`;
    
    const playerSpan = document.createElement('span');
    playerSpan.className = 'player';
    playerSpan.textContent = entry.username;
    
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'high-score';
    scoreSpan.textContent = entry.score;
    
    leaderboardItem.appendChild(rankSpan);
    leaderboardItem.appendChild(playerSpan);
    leaderboardItem.appendChild(scoreSpan);
    
    leaderboardEntriesContainer.appendChild(leaderboardItem);
  });
  
  // If the current user isn't on the leaderboard yet, add them
  if (!sortedLeaderboard.some(entry => entry.username === gameState.username)) {
    addCurrentUserToLeaderboard();
  }
  
  console.log('Leaderboard updated with', sortedLeaderboard.length, 'entries');
  window.logDiagnostic(`Leaderboard updated: ${sortedLeaderboard.length} entries`);
}

// Add the current user to the leaderboard if they're not already there
function addCurrentUserToLeaderboard() {
  const leaderboardItem = document.createElement('div');
  leaderboardItem.className = 'leaderboard-item current-user';
  
  const rankSpan = document.createElement('span');
  rankSpan.className = 'rank';
  rankSpan.textContent = '-';
  
  const playerSpan = document.createElement('span');
  playerSpan.className = 'player';
  playerSpan.textContent = gameState.username;
  
  const scoreSpan = document.createElement('span');
  scoreSpan.className = 'high-score';
  scoreSpan.textContent = gameState.score;
  
  leaderboardItem.appendChild(rankSpan);
  leaderboardItem.appendChild(playerSpan);
  leaderboardItem.appendChild(scoreSpan);
  
  leaderboardEntriesContainer.appendChild(leaderboardItem);
}

// ===== Game Logic =====
// Initialize the game
function initGame() {
  window.logDiagnostic("Initializing game");
  
  // Initialize sound effects early
  initAudioContext();
  createCorrectSound();
  createIncorrectSound();
  
  // Set up event listener for play again button
  playAgainButton.addEventListener('click', () => {
    // Send a message to play the same category again
    window.logDiagnostic("Play Again button clicked");
    sendMessage({
      type: 'playAgain',
        data: { 
        category: gameState.lastPlayedCategory
      }
    });
  });
  
  // Set up event listener for next category button
  nextCategoryButton.addEventListener('click', () => {
    // Show the category selection screen
    window.logDiagnostic("Next Category button clicked");
    
    // Refresh DOM references first to ensure we have everything
    refreshDOMReferences();
    
    // Make sure the category screen is properly set up
    if (!categorySelectScreen || !document.getElementById('category-select')) {
      window.logDiagnostic("Category select screen not found - attempting emergency repair");
      const repairedScreen = repairCategoryScreen();
      
      if (!repairedScreen) {
        window.logDiagnostic("CRITICAL ERROR: Could not repair category screen");
        // Show an error message to the user
        const errorMsg = document.createElement('div');
        errorMsg.style.position = 'fixed';
        errorMsg.style.top = '50%';
        errorMsg.style.left = '50%';
        errorMsg.style.transform = 'translate(-50%, -50%)';
        errorMsg.style.backgroundColor = '#f44336';
        errorMsg.style.color = 'white';
        errorMsg.style.padding = '20px';
        errorMsg.style.borderRadius = '4px';
        errorMsg.style.zIndex = '10000';
        errorMsg.style.textAlign = 'center';
        errorMsg.innerHTML = `
          <strong>Error:</strong> Category selection screen could not be created.<br>
          <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: white; color: black; border: none; border-radius: 4px;">
            Refresh Page
          </button>
        `;
        document.body.appendChild(errorMsg);
        return;
      }
      
      // Use the repaired screen
      window.categorySelectScreen = repairedScreen;
    }
    
    // Double check that all category buttons have event listeners
    setupCategoryButtons();
    
    // Show the category screen - get it directly from the DOM to be safe
    const screenToShow = categorySelectScreen || document.getElementById('category-select');
    showScreen(screenToShow);
    window.logDiagnostic("Category selection screen shown");
  });
  
  // Set up event listeners for category buttons using our helper function
  setupCategoryButtons();
  
  // Set up event listener for show leaderboard button
  showLeaderboardButton.addEventListener('click', () => {
    // Request updated leaderboard data
    window.logDiagnostic("Show Leaderboard button clicked");
    sendMessage({
      type: 'requestLeaderboard'
    });
    
    // Update the leaderboard with existing data while waiting for response
    updateLeaderboard();
    
    // Show the leaderboard screen
    showScreen(leaderboardScreen);
  });
  
  // Set up event listener for back to categories button
  backToCategoriesButton.addEventListener('click', () => {
    // Show the category selection screen
    window.logDiagnostic("Back to Categories button clicked");
    
    // Make sure category buttons are set up
    setupCategoryButtons();
    
    // Show the category selection screen
    showScreen(categorySelectScreen);
  });
  
  // Initialize audio context when user interacts
  document.addEventListener('click', initAudioContext, { once: true });
  
  // Don't default to any screen - wait for message handling to determine the correct screen
  window.logDiagnostic("Game initialization complete");
}

// Show a loading state while waiting for data
function showLoadingState(category) {
  // Update the current category display
  currentCategoryElement.textContent = category;
  
  // Show the game play screen with loading indicators
  showScreen(gamePlayScreen);
  
  // Clear previous content
  celebritiesContainer.innerHTML = '<div id="loading-message">Loading celebrities...</div>';
  quoteTextElement.textContent = 'Loading quote...';
  
  // Reset the timer but don't start it yet
  timerTextElement.textContent = gameState.timerDuration.toString();
  timerBarElement.style.width = '100%';
}

// Initialize Audio Context
function initAudioContext() {
  if (audioContext) return;
  
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create correct/incorrect sound effects using Web Audio API
    createImprovedSoundEffects();
  } catch (error) {
    console.error('Error initializing audio context:', error);
  }
}

// Create better sound effects using Web Audio API
function createImprovedSoundEffects() {
  // Create audio context if it doesn't exist
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  window.logDiagnostic('Creating improved sound effects with Web Audio API');
  
  // Create correct sound effect (happy ascending chime)
  createCorrectSound();
  
  // Create incorrect sound effect (error buzzer)
  createIncorrectSound();
}

// Generate a pleasant ascending chime for correct answers
function createCorrectSound() {
  try {
    // Create audio context if it doesn't exist
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (err) {
        console.error('Failed to create audio context:', err);
        return;
      }
    }
    
    const duration = 1.0;
    const correctBuffer = audioContext.createBuffer(2, audioContext.sampleRate * duration, audioContext.sampleRate);
    
    // Create two channels for stereo
    for (let channel = 0; channel < 2; channel++) {
      const channelData = correctBuffer.getChannelData(channel);
      
      // Create a happy ascending arpeggio
      // Major chord frequencies: f, f*5/4, f*3/2, f*2
      const baseFreq = 440; // A4
      
      for (let i = 0; i < channelData.length; i++) {
        const t = i / correctBuffer.sampleRate; // Time in seconds
        
        // Amplitude envelope: quick attack, longer decay
        const envelope = Math.min(1, t * 10) * Math.exp(-3 * t);
        
        // First note (0-0.2s)
        let sample = 0;
        if (t < 0.2) {
          sample = Math.sin(2 * Math.PI * baseFreq * t);
        } 
        // Second note (0.2-0.4s)
        else if (t < 0.4) {
          sample = Math.sin(2 * Math.PI * (baseFreq * 5/4) * t);
        }
        // Third note (0.4-0.6s)
        else if (t < 0.6) {
          sample = Math.sin(2 * Math.PI * (baseFreq * 3/2) * t);
        }
        // Fourth note (0.6-1.0s)
        else {
          sample = Math.sin(2 * Math.PI * (baseFreq * 2) * t);
        }
        
        // Add a bit of the previous note for smoothness
        if (t > 0.2 && t < 0.25) {
          const blend = (0.25 - t) / 0.05;
          sample = blend * Math.sin(2 * Math.PI * baseFreq * t) + (1 - blend) * sample;
        }
        else if (t > 0.4 && t < 0.45) {
          const blend = (0.45 - t) / 0.05;
          sample = blend * Math.sin(2 * Math.PI * (baseFreq * 5/4) * t) + (1 - blend) * sample;
        }
        else if (t > 0.6 && t < 0.65) {
          const blend = (0.65 - t) / 0.05;
          sample = blend * Math.sin(2 * Math.PI * (baseFreq * 3/2) * t) + (1 - blend) * sample;
        }
        
        // Add some harmonics for richness
        sample += 0.3 * Math.sin(4 * Math.PI * baseFreq * t) * Math.exp(-5 * t);
        
        // Apply envelope and write to buffer
        channelData[i] = 0.5 * sample * envelope;
      }
    }
    
    // Convert to WAV and set as source for correctAudio
    const correctWav = bufferToWav(correctBuffer);
    if (window.correctAudio) {
      window.correctAudio.src = correctWav;
      
      // Force load the audio but don't play it yet
      window.correctAudio.load();
    }
    
    window.logDiagnostic('Created correct sound effect');
  } catch (err) {
    console.error('Error creating correct sound:', err);
    window.logDiagnostic(`Error creating correct sound: ${err.message}`);
    
    // Fallback to a simple tone as last resort
    try {
      if (window.correctAudio) {
        window.correctAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
      }
    } catch (fallbackErr) {
      console.error('Failed to set fallback sound:', fallbackErr);
    }
  }
}

// Generate a buzzing error sound for incorrect answers
function createIncorrectSound() {
  try {
    // Create audio context if it doesn't exist
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (err) {
        console.error('Failed to create audio context:', err);
        return;
      }
    }
    
    const duration = 0.7;
    const incorrectBuffer = audioContext.createBuffer(2, audioContext.sampleRate * duration, audioContext.sampleRate);
    
    // Create two channels for stereo
    for (let channel = 0; channel < 2; channel++) {
      const channelData = incorrectBuffer.getChannelData(channel);
      
      // Create an error buzz sound
      const baseFreq = 220; // A3
      
      for (let i = 0; i < channelData.length; i++) {
        const t = i / incorrectBuffer.sampleRate; // Time in seconds
        
        // Two pulses with amplitude envelope
        const envelope = 
          (t < 0.3 ? Math.min(1, t * 10) * Math.exp(-10 * t) : 0) + 
          (t >= 0.3 ? Math.min(1, (t - 0.3) * 10) * Math.exp(-10 * (t - 0.3)) : 0);
        
        // Base frequency with slight downward shift
        const freqShift = baseFreq * (1 - t * 0.2);
        
        // Main tone with dissonant frequencies for harshness
        let sample = Math.sin(2 * Math.PI * freqShift * t);
        sample += 0.5 * Math.sin(2 * Math.PI * (freqShift * 1.05) * t); // Dissonant frequency
        sample += 0.3 * Math.sin(2 * Math.PI * (freqShift * 2.03) * t); // Slightly detuned harmonic
        
        // Add noise component
        sample += 0.2 * (Math.random() * 2 - 1);
        
        // Add fluctuation/wobble effect
        const wobble = 0.15 * Math.sin(2 * Math.PI * 8 * t);
        
        // Apply envelope and write to buffer
        channelData[i] = 0.5 * sample * envelope * (1 + wobble);
      }
    }
    
    // Convert to WAV and set as source for incorrectAudio
    const incorrectWav = bufferToWav(incorrectBuffer);
    if (window.incorrectAudio) {
      window.incorrectAudio.src = incorrectWav;
      
      // Force load the audio but don't play it yet
      window.incorrectAudio.load();
    }
    
    window.logDiagnostic('Created incorrect sound effect');
  } catch (err) {
    console.error('Error creating incorrect sound:', err);
    window.logDiagnostic(`Error creating incorrect sound: ${err.message}`);
    
    // Fallback to a simple tone as last resort
    try {
      if (window.incorrectAudio) {
        window.incorrectAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
      }
    } catch (fallbackErr) {
      console.error('Failed to set fallback sound:', fallbackErr);
    }
  }
}

// Convert AudioBuffer to WAV data URL
function bufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  
  // Create a buffer with header and data
  const wavBuffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view = new DataView(wavBuffer);
  
  // Write RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length * numChannels * 2, true);
  writeString(view, 8, 'WAVE');
  
  // Write fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  
  // Write data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, length * numChannels * 2, true);
  
  // Write audio data
  const data = buffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }
  
  // Convert to base64 data URL
  const blob = new Blob([view], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  return url;
}

// Helper function to write strings to DataView
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Create base64-encoded dummy audio
function createDummyAudio() {
  return 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
}

// Start the game with a quote and celebrities
function startGame(category, quoteData) {
  console.log('Starting game with data:', quoteData);
  window.logDiagnostic(`Starting game for category: ${category}`);
  
  try {
    // Remove loading indicator if present
    const loadingIndicator = document.getElementById('initial-loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
      window.logDiagnostic("Removed loading indicator in startGame");
    }
    
    // Enable audio for the game
    enableGameAudio();
    
    // Refresh DOM references first to ensure we have everything
    refreshDOMReferences();
    
    // Set game state
    gameState.isPlaying = true;
    gameState.selectedCelebrity = null;
    
    // Make sure DOM elements are available
    if (!gamePlayScreen || !celebritiesContainer || !quoteTextElement) {
      console.error("Key game elements not found - trying to get them directly from the DOM");
      window.logDiagnostic("ERROR: Key game elements not found - trying direct DOM access");
      
      // Try to get elements directly
      const directGamePlayScreen = document.getElementById('game-play');
      const directCelebritiesContainer = document.getElementById('celebrities-container');
      const directQuoteTextElement = document.getElementById('quote-text');
      
      if (directGamePlayScreen) {
        gamePlayScreen = directGamePlayScreen;
        window.gamePlayScreen = directGamePlayScreen;
        window.logDiagnostic("Found game-play screen via direct DOM access");
      }
      
      if (directCelebritiesContainer) {
        celebritiesContainer = directCelebritiesContainer;
        window.celebritiesContainer = directCelebritiesContainer;
        window.logDiagnostic("Found celebrities-container via direct DOM access");
      }
      
      if (directQuoteTextElement) {
        quoteTextElement = directQuoteTextElement;
        window.quoteTextElement = directQuoteTextElement;
        window.logDiagnostic("Found quote-text element via direct DOM access");
      }
      
      // Check again after direct access attempts
      if (!gamePlayScreen || !celebritiesContainer || !quoteTextElement) {
        window.logDiagnostic("CRITICAL ERROR: Still can't find key game elements!");
        console.error("CRITICAL ERROR: Still can't find key game elements!");
        
        // Create a visible error message for the user
        const errorMessage = document.createElement('div');
        errorMessage.style.position = 'fixed';
        errorMessage.style.top = '50%';
        errorMessage.style.left = '50%';
        errorMessage.style.transform = 'translate(-50%, -50%)';
        errorMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        errorMessage.style.color = 'white';
        errorMessage.style.padding = '20px';
        errorMessage.style.borderRadius = '10px';
        errorMessage.style.zIndex = '9999';
        errorMessage.style.textAlign = 'center';
        errorMessage.style.maxWidth = '80%';
        
        errorMessage.innerHTML = `
          <h3 style="color: red;">Error Loading Game</h3>
          <p>Could not find required game elements</p>
          <button id="reload-game-btn" style="
            background-color: #F5F834;
            color: black;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            margin-top: 15px;
            font-weight: bold;
            cursor: pointer;">
            Reload Game
          </button>
        `;
        
        document.body.appendChild(errorMessage);
        
        // Add event listener for reload button
        document.getElementById('reload-game-btn').addEventListener('click', () => {
          window.location.reload();
        });
        
        return;
      }
    }
    
    // Hide all screens first
    document.querySelectorAll('.game-screen').forEach(screen => {
      screen.style.display = 'none';
    });
    
    // Ensure the game play screen is visible
    window.logDiagnostic("Showing game play screen");
    gamePlayScreen.style.display = 'flex';
    gamePlayScreen.classList.add('active');
    
    // Optimize the game play screen layout for better fit
    optimizeGamePlayLayout();
    
    // Update current category display
    const currentCategoryEl = currentCategoryElement || document.getElementById('current-category');
    if (currentCategoryEl) {
      currentCategoryEl.textContent = category;
    }
    
    // Update quote text
    const quoteTextEl = quoteTextElement || document.getElementById('quote-text');
    if (quoteTextEl) {
      quoteTextEl.textContent = `"${quoteData.quote}"`;
      // Limit max height of quote text to prevent overflow
      quoteTextEl.style.maxHeight = '80px';
      quoteTextEl.style.overflow = 'auto';
      console.log("Quote text updated:", quoteData.quote);
      window.logDiagnostic(`Quote text updated: "${quoteData.quote.substring(0, 30)}..."`);
    }
    
    // Clear previous content in celebrities container
    const celebritiesContainerEl = celebritiesContainer || document.getElementById('celebrities-container');
    if (celebritiesContainerEl) {
      celebritiesContainerEl.innerHTML = '';
    }
    
    // Create buttons for each celebrity
    console.log('Creating celebrity buttons:', quoteData.celebrities);
    window.logDiagnostic(`Creating ${quoteData.celebrities.length} celebrity buttons`);
    
    createButtonsFromQuoteData(quoteData);
    
    // Reset and start the timer as the last step, after everything is set up
    resetTimer();
    startTimer();
    window.logDiagnostic("Game setup complete, timer started");
    } catch (error) {
    console.error("Error starting game:", error);
    window.logDiagnostic(`ERROR starting game: ${error.message}`);
    
    // Create a visible error message for the user
    const errorMessage = document.createElement('div');
    errorMessage.style.position = 'fixed';
    errorMessage.style.top = '50%';
    errorMessage.style.left = '50%';
    errorMessage.style.transform = 'translate(-50%, -50%)';
    errorMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    errorMessage.style.color = 'white';
    errorMessage.style.padding = '20px';
    errorMessage.style.borderRadius = '10px';
    errorMessage.style.zIndex = '9999';
    errorMessage.style.textAlign = 'center';
    errorMessage.style.maxWidth = '80%';
    
    errorMessage.innerHTML = `
      <h3 style="color: red;">Error Starting Game</h3>
      <p>${error.message}</p>
      <button id="retry-game-btn" style="
        background-color: #F5F834;
        color: black;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        margin-top: 15px;
        font-weight: bold;
        cursor: pointer;">
        Try Again
      </button>
    `;
    
    document.body.appendChild(errorMessage);
    
    // Add event listener for retry button
    document.getElementById('retry-game-btn').addEventListener('click', () => {
      errorMessage.remove();
      window.testReceiveGameData();
    });
  }
}

// Helper function to optimize game play layout
function optimizeGamePlayLayout() {
  // Make game play screen more compact
  if (gamePlayScreen) {
    // Make sure it uses flexbox layout
    gamePlayScreen.style.display = 'flex';
    gamePlayScreen.style.flexDirection = 'column';
    gamePlayScreen.style.justifyContent = 'flex-start';
    gamePlayScreen.style.padding = '8px'; 
    gamePlayScreen.style.boxSizing = 'border-box';
    gamePlayScreen.style.maxWidth = '100vw';
    gamePlayScreen.style.width = '100%';
    gamePlayScreen.style.margin = '0';
    gamePlayScreen.style.height = 'auto'; // Changed from fixed height to auto
    gamePlayScreen.style.maxHeight = '100vh';
    gamePlayScreen.style.overflowY = 'auto'; // Allow scrolling
    gamePlayScreen.style.position = 'relative';
    gamePlayScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  }
  
  // Fix sticky timer position at the top
  const timerContainer = document.getElementById('timer-container');
  if (timerContainer) {
    timerContainer.style.position = 'sticky';
    timerContainer.style.top = '0';
    timerContainer.style.zIndex = '100';
    timerContainer.style.width = '100%';
    timerContainer.style.height = '10px';
    timerContainer.style.margin = '0 0 15px 0';
    timerContainer.style.backgroundColor = 'rgba(0,0,0,0.5)';
    timerContainer.style.borderRadius = '5px';
    timerContainer.style.overflow = 'visible';
    timerContainer.style.boxShadow = '0 3px 10px rgba(0,0,0,0.3)';
    timerContainer.style.padding = '0';
    
    // Make sure it's the first child of game play screen
    if (gamePlayScreen && gamePlayScreen.firstChild !== timerContainer) {
      gamePlayScreen.insertBefore(timerContainer, gamePlayScreen.firstChild);
      window.logDiagnostic("Moved timer to the very top of game play screen");
    }
  }

  // Optimize timer bar
  if (timerBarElement) {
    timerBarElement.style.height = '10px';
    timerBarElement.style.borderRadius = '5px';
    timerBarElement.style.backgroundColor = 'var(--primary-color, #F5F834)';
    timerBarElement.style.transition = 'width 0.9s linear, background-color 0.3s ease';
    timerBarElement.style.boxShadow = '0 0 8px rgba(245, 248, 52, 0.5)';
    timerBarElement.style.width = '100%';
  }
  
  // Optimize timer text
  if (timerTextElement) {
    timerTextElement.style.position = 'absolute';
    timerTextElement.style.top = '-8px';
    timerTextElement.style.right = '10px';
    timerTextElement.style.fontWeight = 'bold';
    timerTextElement.style.fontSize = '20px';
    timerTextElement.style.color = 'var(--primary-color, #F5F834)';
    timerTextElement.style.textShadow = '0 0 5px rgba(0,0,0,0.8)';
    timerTextElement.style.padding = '3px 8px';
    timerTextElement.style.background = 'rgba(0,0,0,0.6)';
    timerTextElement.style.borderRadius = '5px';
    timerTextElement.style.zIndex = '101';
  }
  
  // Make quote container more compact but still readable
  const quoteContainer = document.getElementById('quote-container');
  if (quoteContainer) {
    quoteContainer.style.margin = '5px 0 10px 0';
    quoteContainer.style.padding = '10px';
    quoteContainer.style.width = '100%';
    quoteContainer.style.boxSizing = 'border-box';
    quoteContainer.style.backgroundColor = 'rgba(0,0,0,0.5)';
    quoteContainer.style.borderRadius = '8px';
    quoteContainer.style.boxShadow = '0 3px 8px rgba(0,0,0,0.3)';
    quoteContainer.style.textAlign = 'center';
    
    // Make the heading smaller
    const quoteH2 = quoteContainer.querySelector('h2');
    if (quoteH2) {
      quoteH2.style.fontSize = '14px';
      quoteH2.style.margin = '0 0 8px 0';
      quoteH2.style.color = 'var(--primary-color, #F5F834)';
    }
  }
  
  // Make sure quote text is clearly visible
  if (quoteTextElement) {
    quoteTextElement.style.fontSize = '15px';
    quoteTextElement.style.margin = '0';
    quoteTextElement.style.padding = '0';
    quoteTextElement.style.maxHeight = '120px';
    quoteTextElement.style.overflowY = 'auto';
    quoteTextElement.style.width = '100%';
    quoteTextElement.style.boxSizing = 'border-box';
    quoteTextElement.style.lineHeight = '1.4';
    quoteTextElement.style.color = 'white';
    quoteTextElement.style.fontStyle = 'italic';
    quoteTextElement.style.textAlign = 'center';
  }
  
  // Make sure current category is hidden
  if (currentCategoryElement && currentCategoryElement.parentElement) {
    currentCategoryElement.parentElement.style.display = 'none';
  }
  
  // Optimize the celebrities container for better fit
  if (celebritiesContainer) {
    celebritiesContainer.style.display = 'grid';
    celebritiesContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
    celebritiesContainer.style.gap = '10px';
    celebritiesContainer.style.width = '100%';
    celebritiesContainer.style.boxSizing = 'border-box';
    celebritiesContainer.style.paddingBottom = '20px';
    celebritiesContainer.style.marginTop = '5px';
    celebritiesContainer.style.maxHeight = 'calc(100vh - 170px)';
    celebritiesContainer.style.overflowY = 'auto';
  }
  
  // Optimize all screens for mobile fit
  const allScreens = document.querySelectorAll('.game-screen');
  allScreens.forEach(screen => {
    screen.style.width = '100%';
    screen.style.maxWidth = '100vw';
    screen.style.boxSizing = 'border-box';
    screen.style.padding = '8px';
    screen.style.overflowY = 'auto';
    screen.style.margin = '0';
    screen.style.gap = '8px';
  });
}

// Modify selectAnswer function to ensure it works reliably
function selectAnswer(celebrity) {
  console.log('User selected celebrity:', celebrity);
  window.logDiagnostic(`User selected: ${celebrity}`);
  
  // Double check we're in a playing state
  if (!gameState.isPlaying) {
    window.logDiagnostic('Game not in playing state - ignoring selection');
    return;
  }
  
  // Stop the timer
  clearInterval(gameState.timerInterval);
  
  // Stop the countdown ticking sound
  if (countdownTicker) {
    countdownTicker.stop();
  }
  
  // Store the selected celebrity
  gameState.selectedCelebrity = celebrity;
  
  // Disable all buttons to prevent multiple selections
  const buttons = document.querySelectorAll('.celebrity-button');
  buttons.forEach(button => {
    button.disabled = true;
    
    // Get the text content from the span inside the button
    const nameSpan = button.querySelector('span');
    const buttonText = nameSpan ? nameSpan.textContent : button.textContent;
    
    // Highlight the selected button
    if (buttonText === celebrity) {
      // Fill with yellow background and update text color
      button.style.backgroundColor = 'var(--primary-color, #F5F834)';
      button.style.color = '#121212'; // Dark text on yellow background
      button.style.borderColor = 'var(--primary-color, #F5F834)';
      
      // Add glow effect and pulse
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 0 15px var(--primary-color, #F5F834), 0 8px 16px var(--button-shadow, rgba(0, 0, 0, 0.3))';
      button.style.animation = 'pulse 1s infinite';
      
      // Make sure the text is visible on yellow background
      if (nameSpan) {
        nameSpan.style.color = '#121212';
      }
      
      // Make sure the image container has highlight too
      const imgContainer = button.querySelector('div');
      if (imgContainer) {
        imgContainer.style.transform = 'scale(1.1)';
        imgContainer.style.border = '2px solid #121212'; // Dark border for contrast
        }
      } else {
      // Dim other buttons
      button.style.opacity = '0.6';
    }
  });
  
  // Create a loading overlay
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'audio-loading-overlay';
  loadingOverlay.style.position = 'fixed';
  loadingOverlay.style.top = '0';
  loadingOverlay.style.left = '0';
  loadingOverlay.style.width = '100%';
  loadingOverlay.style.height = '100%';
  loadingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  loadingOverlay.style.zIndex = '9999';
  loadingOverlay.style.display = 'flex';
  loadingOverlay.style.flexDirection = 'column';
  loadingOverlay.style.justifyContent = 'center';
  loadingOverlay.style.alignItems = 'center';
  loadingOverlay.style.color = 'white';
  loadingOverlay.style.fontWeight = 'bold';
  
  // Add spinner
  const spinner = document.createElement('div');
  spinner.style.width = '40px';
  spinner.style.height = '40px';
  spinner.style.border = '4px solid rgba(255, 255, 255, 0.3)';
  spinner.style.borderTop = '4px solid #F5F834';
  spinner.style.borderRadius = '50%';
  spinner.style.animation = 'spin 1s linear infinite';
  spinner.style.marginBottom = '20px';
  
  const loadingText = document.createElement('div');
  loadingText.style.fontSize = '18px';
  loadingText.textContent = `Playing: ${celebrity}`;
  
  loadingOverlay.appendChild(spinner);
  loadingOverlay.appendChild(loadingText);
  document.body.appendChild(loadingOverlay);
  
  // Set up a style for the spinner animation if it doesn't exist
  if (!document.querySelector('style#spin-anim')) {
    const style = document.createElement('style');
    style.id = 'spin-anim';
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Set a failsafe timer to ensure we show results even if audio fails
  const failsafeTimer = setTimeout(() => {
    window.logDiagnostic('Failsafe timer triggered - proceeding to results');
    if (document.body.contains(loadingOverlay)) {
      loadingOverlay.remove();
    }
    
    // Simply show results if audio fails
    showGameResults(celebrity);
  }, 5000); // 5 seconds max wait for audio
  
  // Try to play the audio for this celebrity
  const audioClips = gameState.currentQuote?.audioClips || {};
  const audioSrc = audioClips[celebrity];
  
  if (audioSrc) {
    window.logDiagnostic(`Found audio clip for ${celebrity}: ${audioSrc}`);
    
    // Create audio element
    const audio = new Audio(audioSrc);
    
    // On successful load, play the audio
    audio.addEventListener('canplaythrough', () => {
      window.logDiagnostic('Celebrity audio loaded successfully, playing...');
      
      // Play the audio
      audio.play()
        .then(() => {
          window.logDiagnostic('Celebrity audio playback started');
          
          // When audio ends, show the result
          audio.addEventListener('ended', () => {
            window.logDiagnostic('Celebrity audio playback ended - showing result');
            clearTimeout(failsafeTimer);
            if (document.body.contains(loadingOverlay)) {
              loadingOverlay.remove();
            }
            
            // Show results when audio finishes
            showGameResults(celebrity);
          });
        })
        .catch(err => {
          // Handle play error
          window.logDiagnostic(`Error playing celebrity audio: ${err.message}`);
          clearTimeout(failsafeTimer);
          if (document.body.contains(loadingOverlay)) {
            loadingOverlay.remove();
          }
          
          // Just show results if audio fails
          showGameResults(celebrity);
        });
    });
    
    // On load error, proceed to result
    audio.addEventListener('error', () => {
      window.logDiagnostic(`Error loading celebrity audio: ${audio.error?.message || 'unknown error'}`);
      clearTimeout(failsafeTimer);
      if (document.body.contains(loadingOverlay)) {
        loadingOverlay.remove();
      }
      
      // Just show results if audio fails
      showGameResults(celebrity);
    });
    
    // Force load attempt
    audio.load();
  } else {
    // No audio found for this celebrity
    window.logDiagnostic(`No audio clip found for ${celebrity}`);
    
    // Add message to the overlay
    const noAudioMsg = document.createElement('div');
    noAudioMsg.style.marginTop = '10px';
    noAudioMsg.style.color = '#F5F834';
    noAudioMsg.textContent = 'No audio available';
    loadingOverlay.appendChild(noAudioMsg);
    
    // Proceed after a short delay
    setTimeout(() => {
      clearTimeout(failsafeTimer);
      if (document.body.contains(loadingOverlay)) {
        loadingOverlay.remove();
      }
      
      // Show results even if no audio
      showGameResults(celebrity);
    }, 1500);
  }
}

// Ensure feedback audio elements exist and are ready
function ensureFeedbackAudio() {
  // Check if the audio elements exist
  let correctAudio = window.correctAudio || document.getElementById('correct-audio');
  let incorrectAudio = window.incorrectAudio || document.getElementById('incorrect-audio');
  
  // Create them if they don't exist
  if (!correctAudio) {
    window.logDiagnostic('Creating missing correct-audio element');
    correctAudio = document.createElement('audio');
    correctAudio.id = 'correct-audio';
    correctAudio.preload = 'auto';
    document.body.appendChild(correctAudio);
    window.correctAudio = correctAudio;
  }
  
  if (!incorrectAudio) {
    window.logDiagnostic('Creating missing incorrect-audio element');
    incorrectAudio = document.createElement('audio');
    incorrectAudio.id = 'incorrect-audio';
    incorrectAudio.preload = 'auto';
    document.body.appendChild(incorrectAudio);
    window.incorrectAudio = incorrectAudio;
  }
  
  // Create the audio context if it doesn't exist
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      window.logDiagnostic('Created audio context in ensureFeedbackAudio');
    } catch (err) {
      console.error('Failed to create audio context:', err);
      window.logDiagnostic(`Failed to create audio context: ${err.message}`);
    }
  }
  
  // Generate the sound effects if needed
  if (!correctAudio.src || correctAudio.src === '' || correctAudio.src.includes('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==')) {
    createCorrectSound();
  }
  
  if (!incorrectAudio.src || incorrectAudio.src === '' || incorrectAudio.src.includes('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==')) {
    createIncorrectSound();
  }
  
  return {correctAudio, incorrectAudio};
}

// Play the appropriate feedback sound based on whether the answer was correct
function playFeedbackSound(isCorrect) {
  window.logDiagnostic(`Playing ${isCorrect ? 'correct' : 'incorrect'} feedback sound`);
  
  try {
    // Make sure we have the audio elements
    const { correctAudio, incorrectAudio } = ensureFeedbackAudio();
    
    // Get the appropriate audio element
    const audioElement = isCorrect ? correctAudio : incorrectAudio;
    
    if (!audioElement) {
      window.logDiagnostic(`Could not find ${isCorrect ? 'correct' : 'incorrect'} audio element`);
      return false;
    }
    
    // Resume audio context if suspended
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        window.logDiagnostic('Audio context resumed');
      }).catch(err => {
        window.logDiagnostic(`Failed to resume audio context: ${err.message}`);
      });
    }
    
    // Make sure the audio is loaded
    audioElement.load();
    
    // Set volume
    audioElement.volume = 0.8; // Slightly reduced volume
    
    // Play the audio
    const playPromise = audioElement.play();
    
    if (playPromise) {
      playPromise
        .then(() => {
          window.logDiagnostic(`${isCorrect ? 'Correct' : 'Incorrect'} feedback sound started playing`);
        })
        .catch(err => {
          window.logDiagnostic(`Error playing ${isCorrect ? 'correct' : 'incorrect'} feedback sound: ${err.message}`);
          
          // Try again with a different approach
          try {
            // Create a direct Web Audio sound
            if (audioContext) {
              // Generate a simple tone as fallback
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();
              
              // Configure the oscillator based on correct/incorrect
              if (isCorrect) {
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // Higher pitch for correct
              } else {
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(220, audioContext.currentTime); // Lower pitch for incorrect
              }
              
              // Configure the gain (volume) with attack and release
              gainNode.gain.setValueAtTime(0, audioContext.currentTime);
              gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05); // Attack
              gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5); // Release
              
              // Connect and play
              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              
      oscillator.start();
              oscillator.stop(audioContext.currentTime + 0.5);
              
              window.logDiagnostic(`Played fallback Web Audio tone for ${isCorrect ? 'correct' : 'incorrect'}`);
            }
          } catch (webAudioErr) {
            window.logDiagnostic(`Failed to play Web Audio fallback: ${webAudioErr.message}`);
          }
        });
    }
    
    return true;
  } catch (error) {
    window.logDiagnostic(`Error in playFeedbackSound: ${error.message}`);
    return false;
  }
}

// Simple function to show game results (replaces endGame)
function showGameResults(selectedCelebrity) {
  console.log('Showing game results for selected celebrity:', selectedCelebrity);
  window.logDiagnostic(`Showing results for: ${selectedCelebrity || 'timeout'}`);
  
  // Game is no longer playing
  gameState.isPlaying = false;
  
  // Determine if the answer was correct
  const isCorrect = selectedCelebrity === gameState.currentQuote.correctCelebrity;
  window.logDiagnostic(`Answer was ${isCorrect ? 'CORRECT!' : 'INCORRECT'}`);
  
  // Calculate points based on time remaining
  const points = isCorrect ? Math.max(5, Math.ceil(gameState.timeRemaining / 2) + 5) : 0;
  
  // Make sure any existing loading overlay is removed
  const existingOverlay = document.getElementById('audio-loading-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
    window.logDiagnostic("Removed existing audio loading overlay");
  }
  
  // Play the appropriate feedback sound
  playFeedbackSound(isCorrect);
  
  try {
    // Get references to result screen elements - try both direct IDs and window variables
    const resultMsgEl = document.getElementById('result-message');
    const correctCelebEl = document.getElementById('correct-celebrity');
    const selectedCelebEl = document.getElementById('selected-celebrity');
    const pointsEl = document.getElementById('points-earned');
    
    if (resultMsgEl) {
      resultMsgEl.textContent = isCorrect ? 'Correct!' : 'Incorrect!';
      resultMsgEl.style.color = isCorrect ? '#4caf50' : '#f44336';
      resultMsgEl.style.fontSize = '28px';
      resultMsgEl.style.fontWeight = 'bold';
      console.log("Updated result message:", resultMsgEl.textContent);
    } else {
      console.error("Could not find result message element");
    }
    
    if (correctCelebEl) {
      correctCelebEl.textContent = gameState.currentQuote.correctCelebrity;
      correctCelebEl.style.color = '#4caf50'; // Green for correct
      correctCelebEl.style.fontWeight = 'bold';
      console.log("Updated correct celebrity:", correctCelebEl.textContent);
        } else {
      console.error("Could not find correct celebrity element");
    }
    
    if (selectedCelebEl) {
      if (selectedCelebrity) {
        selectedCelebEl.textContent = selectedCelebrity;
        selectedCelebEl.style.color = isCorrect ? '#4caf50' : '#f44336';
        selectedCelebEl.style.fontWeight = 'bold';
      } else {
        selectedCelebEl.textContent = "Time's up! No selection made.";
        selectedCelebEl.style.color = '#f44336'; // Red for incorrect
      }
      console.log("Updated selected celebrity:", selectedCelebEl.textContent);
    } else {
      console.error("Could not find selected celebrity element");
    }
    
    if (pointsEl) {
      pointsEl.textContent = points.toString();
      pointsEl.style.color = '#F5F834'; // Yellow for points
      pointsEl.style.fontWeight = 'bold';
      pointsEl.style.fontSize = '18px';
      console.log("Updated points earned:", pointsEl.textContent);
    } else {
      console.error("Could not find points earned element");
    }

    // Get the result screen element
    const resultScreen = document.getElementById('game-result');
    
    // Hide all screens first - explicitly
    document.querySelectorAll('.game-screen').forEach(screen => {
      screen.style.display = 'none';
      screen.classList.remove('active');
    });
    
    // Make sure the result screen is properly styled
    if (resultScreen) {
      // Explicitly style the result screen
      resultScreen.style.display = 'flex';
      resultScreen.style.flexDirection = 'column';
      resultScreen.style.justifyContent = 'center';
      resultScreen.style.alignItems = 'center';
      resultScreen.style.padding = '20px';
      resultScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      resultScreen.style.color = 'white';
      resultScreen.style.borderRadius = '10px';
      resultScreen.style.gap = '15px';
      resultScreen.style.textAlign = 'center';
      resultScreen.style.zIndex = '100';
      resultScreen.classList.add('active');
      
      // Force result details to be visible
      const resultDetails = document.getElementById('result-details');
      if (resultDetails) {
        resultDetails.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        resultDetails.style.padding = '15px';
        resultDetails.style.borderRadius = '8px';
        resultDetails.style.margin = '10px 0';
        resultDetails.style.width = '100%';
        resultDetails.style.boxSizing = 'border-box';
        resultDetails.style.display = 'block';
      }
      
      // Force score feedback to be visible
      const scoreFeedback = document.getElementById('score-feedback');
      if (scoreFeedback) {
        scoreFeedback.style.display = 'block';
        scoreFeedback.style.marginTop = '15px';
        scoreFeedback.style.marginBottom = '15px';
      }
      
      // Style and ensure action buttons are visible
      const playAgainBtn = document.getElementById('play-again');
      const nextCategoryBtn = document.getElementById('next-category');
      
      if (playAgainBtn) {
        playAgainBtn.style.display = 'block';
        playAgainBtn.style.visibility = 'visible';
        playAgainBtn.style.backgroundColor = '#121212';
        playAgainBtn.style.color = 'white';
        playAgainBtn.style.border = '3px solid #F5F834';
        playAgainBtn.style.padding = '12px 20px';
        playAgainBtn.style.margin = '10px auto';
        playAgainBtn.style.borderRadius = '8px';
        playAgainBtn.style.fontWeight = 'bold';
        playAgainBtn.style.fontSize = '16px';
        playAgainBtn.style.width = '80%';
        playAgainBtn.style.maxWidth = '300px';
        playAgainBtn.style.cursor = 'pointer';
        playAgainBtn.style.zIndex = '101';
        playAgainBtn.style.opacity = '1';
        
        // Re-attach click handler if needed
        if (!playAgainBtn._hasListener) {
          playAgainBtn.addEventListener('click', function() {
            console.log("Play Again button clicked");
            window.logDiagnostic("Play Again button clicked");
            sendMessage({
              type: 'playAgain',
              data: {
                category: gameState.lastPlayedCategory
              }
            });
          });
          playAgainBtn._hasListener = true;
        }
      }
      
      if (nextCategoryBtn) {
        nextCategoryBtn.style.display = 'block';
        nextCategoryBtn.style.visibility = 'visible';
        nextCategoryBtn.style.backgroundColor = '#121212';
        nextCategoryBtn.style.color = 'white';
        nextCategoryBtn.style.border = '3px solid #F5F834';
        nextCategoryBtn.style.padding = '12px 20px';
        nextCategoryBtn.style.margin = '10px auto';
        nextCategoryBtn.style.borderRadius = '8px';
        nextCategoryBtn.style.fontWeight = 'bold';
        nextCategoryBtn.style.fontSize = '16px';
        nextCategoryBtn.style.width = '80%';
        nextCategoryBtn.style.maxWidth = '300px';
        nextCategoryBtn.style.cursor = 'pointer';
        nextCategoryBtn.style.zIndex = '101';
        nextCategoryBtn.style.opacity = '1';
        
        // Re-attach click handler if needed
        if (!nextCategoryBtn._hasListener) {
          nextCategoryBtn.addEventListener('click', function() {
            console.log("Next Category button clicked");
            window.logDiagnostic("Next Category button clicked");
            
            // Go back to category select screen
            const categoryScreen = document.getElementById('category-select');
            if (categoryScreen) {
              document.querySelectorAll('.game-screen').forEach(screen => {
                screen.style.display = 'none';
                screen.classList.remove('active');
              });
              categoryScreen.style.display = 'flex';
              categoryScreen.classList.add('active');
            }
          });
          nextCategoryBtn._hasListener = true;
        }
      }
      
      console.log("Result screen should now be visible");
      window.logDiagnostic("Result screen display complete");
    } else {
      console.error("Could not find game result screen - using fallback");
      window.logDiagnostic("ERROR: Could not find game result screen");
      
      // Use fallback notification
      createSimpleResultPopup(isCorrect, selectedCelebrity, gameState.currentQuote.correctCelebrity, points);
    }
    } catch (error) {
    console.error("Error showing results:", error);
    window.logDiagnostic(`ERROR showing results: ${error.message}`);
    
    // Use fallback notification in case of error
    createSimpleResultPopup(isCorrect, selectedCelebrity, gameState.currentQuote.correctCelebrity, points);
  }
  
  // Update the score if correct
  if (isCorrect) {
    gameState.score += points;
    const scoreEl = document.getElementById('score');
    if (scoreEl) {
      scoreEl.textContent = gameState.score.toString();
    }
    
    // Update the leaderboard
    updateUserLeaderboardEntry();
  }
  
  // Notify Devvit of the result
  sendMessage({
    type: 'quoteAnswered',
    data: {
      correct: isCorrect,
      score: points,
      totalScore: gameState.score,
      category: gameState.currentCategory
    }
  });
}

// Create a simple popup for results if everything else fails
function createSimpleResultPopup(isCorrect, selectedCelebrity, correctCelebrity, points) {
  // Create a simple popup
  const popup = document.createElement('div');
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.backgroundColor = isCorrect ? '#4caf50' : '#f44336';
  popup.style.color = 'white';
  popup.style.padding = '20px';
  popup.style.borderRadius = '10px';
  popup.style.textAlign = 'center';
  popup.style.zIndex = '99999';
  popup.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.5)';
  popup.style.maxWidth = '80%';
  
  // Add content to the popup
  popup.innerHTML = `
    <div style="font-size: 24px; font-weight: bold; margin-bottom: 15px;">
      ${isCorrect ? 'CORRECT!' : 'INCORRECT!'}
    </div>
    <div style="margin-bottom: 10px;">
      The quote was said by: <strong>${correctCelebrity}</strong>
    </div>
    <div style="margin-bottom: 15px;">
      You selected: <strong>${selectedCelebrity || 'No selection'}</strong>
    </div>
    ${isCorrect ? `<div style="color: #F5F834; font-weight: bold; margin-bottom: 15px;">
      Points earned: ${points}
    </div>` : ''}
    <button id="popup-continue" style="
      background-color: #121212;
      color: white;
      border: 2px solid #F5F834;
      padding: 10px 20px;
      border-radius: 5px;
      font-weight: bold;
      cursor: pointer;
    ">Continue</button>
  `;
  
  // Add to document
  document.body.appendChild(popup);
  
  // Add event listener to continue button
  document.getElementById('popup-continue').addEventListener('click', () => {
    popup.remove();
    
    // Try to show category screen
    const categoryScreen = document.getElementById('category-select');
    if (categoryScreen) {
      document.querySelectorAll('.game-screen').forEach(screen => {
        screen.style.display = 'none';
        screen.classList.remove('active');
      });
      categoryScreen.style.display = 'flex';
      categoryScreen.classList.add('active');
    }
  });
  
  // Auto-remove after 15 seconds
  setTimeout(() => {
    if (document.body.contains(popup)) {
      popup.remove();
    }
  }, 15000);
}

// Make the window.endGame directly reference our simplified result function
window.endGame = showGameResults;

// Update the user's entry in the leaderboard
function updateUserLeaderboardEntry() {
  // Check if the user already has an entry
  const existingEntryIndex = gameState.leaderboard.findIndex(entry => 
    entry.username === gameState.username
  );
  
  if (existingEntryIndex !== -1) {
    // Update existing entry if the new score is higher
    if (gameState.score > gameState.leaderboard[existingEntryIndex].score) {
      gameState.leaderboard[existingEntryIndex].score = gameState.score;
      console.log('Updated leaderboard entry for', gameState.username);
        }
      } else {
    // Add a new entry
    gameState.leaderboard.push({
      username: gameState.username,
      score: gameState.score
    });
    console.log('Added new leaderboard entry for', gameState.username);
  }
}

// Helper function to safely get DOM elements
function getElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.error(`Element with ID '${id}' not found`);
    window.logDiagnostic(`ERROR: Element with ID '${id}' not found`);
  }
  return element;
}

// Ensure all DOM references are proper
function refreshDOMReferences() {
  window.usernameElement = getElement('username');
  window.scoreElement = getElement('score');
  window.gamePlayScreen = getElement('game-play');
  window.gameResultScreen = getElement('game-result');
  window.categorySelectScreen = getElement('category-select');
  window.leaderboardScreen = getElement('leaderboard-screen');
  window.currentCategoryElement = getElement('current-category');
  window.quoteTextElement = getElement('quote-text');
  window.timerBarElement = getElement('timer-bar');
  window.timerTextElement = getElement('timer-text');
  window.celebritiesContainer = getElement('celebrities-container');
  window.resultMessageElement = getElement('result-message');
  window.correctCelebrityElement = getElement('correct-celebrity');
  window.selectedCelebrityElement = getElement('selected-celebrity');
  window.pointsEarnedElement = getElement('points-earned');
  window.playAgainButton = getElement('play-again');
  window.nextCategoryButton = getElement('next-category');
  window.showLeaderboardButton = getElement('show-leaderboard');
  window.backToCategoriesButton = getElement('back-to-categories');
  window.leaderboardEntriesContainer = getElement('leaderboard-entries');
  window.quoteAudio = getElement('quote-audio');
  window.correctAudio = getElement('correct-audio');
  window.incorrectAudio = getElement('incorrect-audio');
  
  // Log the state of key elements
  console.log('DOM Elements reloaded:');
  window.logDiagnostic("DOM references refreshed");
  
  return {
    allFound: !!(window.celebritiesContainer && window.gamePlayScreen && 
                 window.categorySelectScreen && window.leaderboardScreen)
  };
}

// Immediately after DOM is loaded, let's add a debug notification
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing game');
  window.logDiagnostic = function(message) {
    console.log(`[LOG] ${message}`);
    // No longer displaying diagnostic messages on screen
  };
  
  // Enable audio on first user interaction
  const enableAudioOnInteraction = () => {
    enableGameAudio();
    window.logDiagnostic("Audio enabled via user interaction");
    
    // Remove event listeners after first interaction
    document.removeEventListener('click', enableAudioOnInteraction);
    document.removeEventListener('touchstart', enableAudioOnInteraction);
    document.removeEventListener('keydown', enableAudioOnInteraction);
  };
  
  // Add event listeners for various interaction types
  document.addEventListener('click', enableAudioOnInteraction);
  document.addEventListener('touchstart', enableAudioOnInteraction);
  document.addEventListener('keydown', enableAudioOnInteraction);
  
  // CRITICAL AUDIO FIX: Make sure audio elements are properly initialized
  const initAudioElements = () => {
    console.log('Initializing audio elements');
    
    // Get references to audio elements
    const correctAudio = document.getElementById('correct-audio');
    const incorrectAudio = document.getElementById('incorrect-audio');
    const quoteAudio = document.getElementById('quote-audio');
    
    // Log audio element status
    window.logDiagnostic(`Audio elements found: 
      correctAudio: ${!!correctAudio}, 
      incorrectAudio: ${!!incorrectAudio}, 
      quoteAudio: ${!!quoteAudio}`);
    
    // If any audio elements don't exist, create them
    if (!correctAudio) {
      console.error('Creating missing correct-audio element');
      const newCorrectAudio = document.createElement('audio');
      newCorrectAudio.id = 'correct-audio';
      newCorrectAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
      newCorrectAudio.preload = 'auto';
      document.body.appendChild(newCorrectAudio);
      window.correctAudio = newCorrectAudio;
    }
    
    if (!incorrectAudio) {
      console.error('Creating missing incorrect-audio element');
      const newIncorrectAudio = document.createElement('audio');
      newIncorrectAudio.id = 'incorrect-audio';
      newIncorrectAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
      newIncorrectAudio.preload = 'auto';
      document.body.appendChild(newIncorrectAudio);
      window.incorrectAudio = newIncorrectAudio;
    }
    
    if (!quoteAudio) {
      console.error('Creating missing quote-audio element');
      const newQuoteAudio = document.createElement('audio');
      newQuoteAudio.id = 'quote-audio';
      newQuoteAudio.preload = 'none';
      document.body.appendChild(newQuoteAudio);
      window.quoteAudio = newQuoteAudio;
    }
    
    // Explicitly set global references to these audio elements
    window.correctAudio = correctAudio || document.getElementById('correct-audio');
    window.incorrectAudio = incorrectAudio || document.getElementById('incorrect-audio');
    window.quoteAudio = quoteAudio || document.getElementById('quote-audio');
    
    // Pre-load sounds to make sure they're ready
    setTimeout(() => {
      try {
        // Try to create audio context to initialize audio system
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          window.audioContext = new AudioContext();
          window.logDiagnostic('Audio context created successfully');
        }
        
        // Force load empty audio to prepare audio system
        if (window.correctAudio) {
          window.correctAudio.load();
          window.logDiagnostic('Preloading correct audio');
        }
        
        if (window.incorrectAudio) {
          window.incorrectAudio.load();
          window.logDiagnostic('Preloading incorrect audio');
        }
      } catch (err) {
        console.error('Error pre-loading audio:', err);
        window.logDiagnostic(`Error pre-loading audio: ${err.message}`);
      }
    }, 500);
  };
  
  // Run the audio initialization
  initAudioElements();
  
  // IMMEDIATE FIX: Force background to be visible
  ensureBackgroundVisible();
  
  // FAILSAFE: Set a dark background color directly on the body as ultimate fallback
  document.body.style.backgroundColor = '#121212';
  document.body.style.color = 'white';
  document.documentElement.style.backgroundColor = '#121212';
  
  // If we can't load the background image, use a gradient backup
  const bgStyle = document.createElement('style');
  bgStyle.id = 'bg-override-styles'; // Add an ID so we can find and remove it if needed
  bgStyle.textContent = `
    body { 
      background-color: transparent !important;
      color: white !important;
    }
    #background-wrapper {
      background-color: #121212 !important;
      background-image: url('assets/hearsay-bg.png') !important;
      background-size: cover !important;
      background-position: center !important;
      background-repeat: no-repeat !important;
      background-attachment: fixed !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    .game-screen {
      display: none;
      background-color: rgba(0, 0, 0, 0.7) !important;
    }
    .game-screen.active {
      display: flex !important;
    }
  `;
  document.head.appendChild(bgStyle);
  
  // IMMEDIATE FIX: Create a loading indicator so user knows something is happening
  const loadingIndicator = document.createElement('div');
  loadingIndicator.id = 'initial-loading-indicator';
  loadingIndicator.style.position = 'fixed';
  loadingIndicator.style.top = '50%';
  loadingIndicator.style.left = '50%';
  loadingIndicator.style.transform = 'translate(-50%, -50%)';
  loadingIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  loadingIndicator.style.color = 'white';
  loadingIndicator.style.padding = '20px';
  loadingIndicator.style.borderRadius = '10px';
  loadingIndicator.style.zIndex = '99999';
  loadingIndicator.style.display = 'flex';
  loadingIndicator.style.flexDirection = 'column';
  loadingIndicator.style.alignItems = 'center';
  loadingIndicator.style.justifyContent = 'center';
  loadingIndicator.style.gap = '15px';
  loadingIndicator.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
  loadingIndicator.style.minWidth = '200px';
  loadingIndicator.style.maxWidth = '80%';
  loadingIndicator.style.textAlign = 'center';
  
  // Add a spinner
  const spinner = document.createElement('div');
  spinner.style.border = '5px solid rgba(255, 255, 255, 0.2)';
  spinner.style.borderTop = '5px solid var(--primary-color, #F5F834)';
  spinner.style.borderRadius = '50%';
  spinner.style.width = '40px';
  spinner.style.height = '40px';
  spinner.style.animation = 'spin 1s linear infinite';
  
  // Add the spinner animation style
  const spinStyle = document.createElement('style');
  spinStyle.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(spinStyle);
  
  // Add loading text
  const loadingText = document.createElement('div');
  loadingText.textContent = 'Loading Hear Say!?';
  loadingText.style.fontSize = '18px';
  loadingText.style.fontWeight = 'bold';
  
  // Add a start button that will appear right away to initialize audio
  const startButton = document.createElement('button');
  startButton.textContent = 'START GAME';
  startButton.style.backgroundColor = 'var(--primary-color, #F5F834)';
  startButton.style.color = '#121212';
  startButton.style.border = 'none';
  startButton.style.borderRadius = '5px';
  startButton.style.padding = '12px 24px';
  startButton.style.marginTop = '15px';
  startButton.style.fontWeight = 'bold';
  startButton.style.cursor = 'pointer';
  startButton.style.fontSize = '16px';
  startButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
  startButton.style.transition = 'all 0.2s ease';
  startButton.style.position = 'relative';
  startButton.style.overflow = 'hidden';
  startButton.style.display = 'block'; // Always show the button immediately

  // Add shine effect to the button
  const shine = document.createElement('div');
  shine.style.position = 'absolute';
  shine.style.top = '0';
  shine.style.left = '0';
  shine.style.width = '100%';
  shine.style.height = '100%';
  shine.style.background = 'linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.3), transparent)';
  shine.style.transform = 'translateX(-100%)';
  shine.style.transition = '0.6s';
  startButton.appendChild(shine);

  // Add hover effects to the start button
  startButton.addEventListener('mouseover', () => {
    startButton.style.transform = 'translateY(-3px)';
    startButton.style.boxShadow = '0 6px 12px rgba(0,0,0,0.4)';
    shine.style.transform = 'translateX(100%)';
  });
  
  startButton.addEventListener('mouseout', () => {
    startButton.style.transform = '';
    startButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
    shine.style.transform = 'translateX(-100%)';
  });
  
  startButton.onclick = () => {
    window.logDiagnostic('Start button clicked - initializing audio and starting game');
    
    // Verify that all critical game elements exist
    const elementsVerified = verifyGameElements();
    if (!elementsVerified) {
      window.logDiagnostic('Critical elements missing or repair failed - showing error');
      
      // Update loading text to show error
      loadingText.textContent = 'Error: Missing game elements';
      loadingText.style.color = 'red';
      
      // Show a try again button
      const repairButton = document.createElement('button');
      repairButton.textContent = 'Repair & Try Again';
      repairButton.style.backgroundColor = '#ff9800';
      repairButton.style.color = 'black';
      repairButton.style.border = 'none';
      repairButton.style.borderRadius = '5px';
      repairButton.style.padding = '12px 24px';
      repairButton.style.marginTop = '10px';
      repairButton.style.fontWeight = 'bold';
      repairButton.style.cursor = 'pointer';
      
      // Add repair button to loading indicator
      loadingIndicator.appendChild(repairButton);
      
      // Add click handler for repair button
      repairButton.onclick = () => {
        window.logDiagnostic('Repair button clicked - forcing DOM creation');
        
        // Remove repair button
        repairButton.remove();
        
        // Reset loading text
        loadingText.textContent = 'Repairing game elements...';
        loadingText.style.color = 'white';
        
        // Force creation of missing elements
        createEmergencyGameElements();
        
        // Try verification again
        if (verifyGameElements()) {
          window.logDiagnostic('Emergency repair successful - proceeding with game start');
          
          // Re-enable the start button
          startButton.disabled = false;
          startButton.style.opacity = '1';
          startButton.style.cursor = 'pointer';
          loadingText.textContent = 'Ready to start game!';
        } else {
          window.logDiagnostic('Emergency repair failed - showing reload message');
          loadingText.innerHTML = 'Critical error - please <a href="javascript:location.reload()" style="color:#F5F834;font-weight:bold;">refresh the page</a>';
        }
      };
      
      return; // Stop here - don't proceed with game startup
    }
    
    // Initialize audio
    enableGameAudio();
    
    // Create and play a test tick to ensure audio is working
    if (countdownTicker) {
      countdownTicker.tick();
    } else {
      // If no countdown ticker exists yet, create one
      countdownTicker = createCountdownTicking();
      if (countdownTicker) {
        countdownTicker.tick();
        window.logDiagnostic('Created countdown ticker on demand and played test tick');
      }
    }
    
    // Change text to indicate loading is happening
    loadingText.textContent = 'Starting game...';
    
    // Disable the start button to prevent multiple clicks
    startButton.disabled = true;
    startButton.style.opacity = '0.7';
    startButton.style.cursor = 'not-allowed';
    
    // Set a flag to track if game started successfully
    let gameStarted = false;
    
    // FIRST ATTEMPT: Try requesting game data from parent frame
    if (!window.gameDataRequested) {
      window.gameDataRequested = true;
      window.logDiagnostic('Sending readyForGameData message after button click');
      
      // Direct function call for immediate feedback
      const messageSent = sendMessage({ 
        type: 'readyForGameData'
      });
      
      window.logDiagnostic(`Message send result: ${messageSent ? 'success' : 'failed'}`);
      
      // If message sending failed, try again after a short delay
      if (!messageSent) {
        setTimeout(() => {
          window.logDiagnostic('Retrying readyForGameData message');
          sendMessage({ type: 'readyForGameData' });
        }, 200);
      }
    }
    
    // SECOND ATTEMPT: If no response after a short delay, use direct method
    setTimeout(() => {
      if (!gameState.currentCategory || !gameState.isPlaying) {
        window.logDiagnostic('No response after message - using direct start method');
        
        // Force start using our robust implementation
        gameStarted = window.testReceiveGameData();
        window.logDiagnostic(`Direct game start result: ${gameStarted ? 'success' : 'failed'}`);
      } else {
        window.logDiagnostic('Game already started via message response');
        gameStarted = true;
      }
    }, 800);
    
    // FINAL GUARANTEED ATTEMPT: Ensure game starts no matter what
    setTimeout(() => {
      if (document.body.contains(loadingIndicator) && !gameStarted) {
        window.logDiagnostic('EMERGENCY FALLBACK: Still not started - forcing direct start');
        window.testReceiveGameData();
      }
    }, 1500);
  };
  
  // Add elements to the loading indicator
  loadingIndicator.appendChild(spinner);
  loadingIndicator.appendChild(loadingText);
  loadingIndicator.appendChild(startButton);
  document.body.appendChild(loadingIndicator);
  
  // IMMEDIATE FIX: Make sure ALL screens are hidden initially
  document.querySelectorAll('.game-screen').forEach(screen => {
    screen.style.display = 'none';
    window.logDiagnostic(`Initially hiding screen: ${screen.id}`);
  });
  
  // Refresh DOM references
  refreshDOMReferences();
  
  // Ensure the background is visible
  ensureBackgroundVisible();
  
  // Initialize the game
  initGame();
  setupMessageListener();
  
  // Don't automatically request game data - wait for START GAME button click
  window.logDiagnostic("Game initialized - waiting for START GAME button click");
  
  // Initialize audio context when user interacts
  document.addEventListener('click', initAudioContext, { once: true });
  
  // Initialize audio files with one immediate interaction to enable audio
  document.body.addEventListener('click', function initAudio() {
    // Create and play a silent audio to enable audio context
    const silentAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==");
    silentAudio.play().catch(err => console.log('Silent audio init:', err));
    document.body.removeEventListener('click', initAudio);
    window.logDiagnostic("Audio initialized via user interaction");

    // Pre-load the correct/incorrect sound effects once user has interacted
    setTimeout(() => {
      try {
        // Initialize audio context if needed
        if (!audioContext) {
          try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            window.logDiagnostic("Audio context created in initAudio");
          } catch (err) {
            console.error('Failed to create audio context:', err);
          }
        }

        // Make sure to create the sound effects for correct/incorrect answers
        createCorrectSound();
        createIncorrectSound();
        
        // Try to pre-load the correct/incorrect sound files
        if (correctAudio) {
          correctAudio.load();
          window.logDiagnostic("Pre-loaded correct audio");
        }
        
        if (incorrectAudio) {
          incorrectAudio.load();
          window.logDiagnostic("Pre-loaded incorrect audio");
      }
    } catch (error) {
        console.error("Error pre-loading audio in initAudio:", error);
      }
    }, 500);
  }, { once: true });
  
  // Fix and ensure result screen buttons are correctly set up
  const fixResultScreenButtons = () => {
    window.logDiagnostic("Checking and fixing result screen buttons");
    const playAgainButton = document.getElementById('play-again');
    const nextCategoryButton = document.getElementById('next-category');
    
    // Ensure buttons exist and are visible when the result screen is shown
    if (playAgainButton) {
      // Don't change display property here - let the showScreen function handle it
      playAgainButton.style.backgroundColor = '#121212';
      playAgainButton.style.color = 'white';
      playAgainButton.style.border = '3px solid var(--primary-color, #F5F834)';
      playAgainButton.style.borderRadius = '8px';
      playAgainButton.style.padding = '10px 15px';
      playAgainButton.style.margin = '10px 5px';
      playAgainButton.style.fontSize = '16px';
      playAgainButton.style.fontWeight = 'bold';
      playAgainButton.style.cursor = 'pointer';
      playAgainButton.style.width = '90%';
      playAgainButton.style.maxWidth = '300px';
      playAgainButton.style.zIndex = '100';
      
      // Ensure event listener is attached
      if (!playAgainButton._hasListeners) {
        playAgainButton.addEventListener('click', () => {
          window.logDiagnostic("Play Again button clicked (from fix)");
          sendMessage({
            type: 'playAgain',
            data: {
              category: gameState.lastPlayedCategory
            }
          });
        });
        playAgainButton._hasListeners = true;
      }
    }
    
    if (nextCategoryButton) {
      // Don't change display property here - let the showScreen function handle it
      nextCategoryButton.style.backgroundColor = '#121212';
      nextCategoryButton.style.color = 'white';
      nextCategoryButton.style.border = '3px solid var(--primary-color, #F5F834)';
      nextCategoryButton.style.borderRadius = '8px';
      nextCategoryButton.style.padding = '10px 15px';
      nextCategoryButton.style.margin = '10px 5px';
      nextCategoryButton.style.fontSize = '16px';
      nextCategoryButton.style.fontWeight = 'bold';
      nextCategoryButton.style.cursor = 'pointer';
      nextCategoryButton.style.width = '90%';
      nextCategoryButton.style.maxWidth = '300px';
      nextCategoryButton.style.zIndex = '100';
      
      // Ensure event listener is attached
      if (!nextCategoryButton._hasListeners) {
        nextCategoryButton.addEventListener('click', () => {
          window.logDiagnostic("Next Category button clicked (from fix)");
          refreshDOMReferences();
          showScreen(categorySelectScreen || document.getElementById('category-select'));
        });
        nextCategoryButton._hasListeners = true;
      }
    }
    
    // Make sure game result screen has proper settings WITHOUT changing display property
    const gameResultScreen = document.getElementById('game-result');
    if (gameResultScreen) {
      // Don't set display: flex here - this was causing the result screen to show prematurely
      gameResultScreen.style.flexDirection = 'column';
      gameResultScreen.style.justifyContent = 'center';
      gameResultScreen.style.alignItems = 'center';
      gameResultScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    }
  };
  
  // Run the fix initially and periodically to ensure buttons work
  fixResultScreenButtons();
  setInterval(fixResultScreenButtons, 3000);
  
  // Auto-send the webViewReady message again after a delay to ensure Devvit receives it
  setTimeout(() => {
    window.logDiagnostic('Sending delayed webViewReady message');
    sendMessage({ type: 'webViewReady' });
    
    // Don't send readyForGameData - wait for button click
    window.logDiagnostic('Waiting for START GAME button click before requesting game data');
    
    // Make sure the background is visible after all initialization
    ensureBackgroundVisible();
  }, 2000);
  
  // DO NOT auto-remove the loading indicator
  // Instead, leave it visible until the user clicks START GAME
  
  // Run audio verification after a short delay
  setTimeout(window.verifyAudioFiles, 2000);
  
  // Fix the background image immediately
  setTimeout(window.fixBackground, 500);
});

// Simplified function to create celebrity buttons with real audio
window.createCelebrityButtons = function() {
  // Make sure we have the container
  let container = window.celebritiesContainer || document.getElementById('celebrities-container');
  
  if (!container) {
    console.error("Can't find celebrities container - creating one");
    window.logDiagnostic("Creating new celebrities container");
    
    // Find the game play screen
    const gamePlayScreen = window.gamePlayScreen || document.getElementById('game-play');
    
    if (!gamePlayScreen) {
      console.error("Can't find game play screen!");
      return;
    }
    
    // Create a new container
    container = document.createElement('div');
    container.id = 'celebrities-container';
    container.style.padding = '0';
    container.style.margin = '8px 0 0 0'; // Added top margin to separate from quote
    container.style.width = '100%';
    container.style.boxSizing = 'border-box';
    
    // Find position to insert - after quote container
    const quoteContainer = document.getElementById('quote-container');
    
    if (quoteContainer && quoteContainer.parentNode === gamePlayScreen) {
      gamePlayScreen.insertBefore(container, quoteContainer.nextSibling);
          } else {
      // Just append to the game play screen
      gamePlayScreen.appendChild(container);
    }
    
    // Update the global reference
    window.celebritiesContainer = container;
  }
  
  // Clear the container
  container.innerHTML = '';
  
  // Style the container to match the category-container
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(2, 1fr)';
  container.style.gap = '0.6rem'; // Further reduced gap
  container.style.width = '100%';
  container.style.margin = '8px 0 0 0'; // Added top margin to separate from quote
  container.style.padding = '0';
  container.style.border = 'none';
  container.style.boxSizing = 'border-box';
  
  // Create celebrity buttons with real audio paths
  const celebrities = [
    "Drake",
    "John Lennon",
    "Psy",
    "Rick Rubin",
    "Snoop Dogg",
    "Ye"
  ];
  
  // Map of celebrities to their audio files (using actual files in webroot/audio/music)
  const audioFiles = {
    "Drake": "audio/music/drake_music.wav",
    "John Lennon": "audio/music/john-lennon_music.wav",
    "Psy": "audio/music/psy_music.wav",
    "Rick Rubin": "audio/music/rick-rubin_music.wav",
    "Snoop Dogg": "audio/music/snoop-dogg_music.wav",
    "Ye": "audio/music/ye_music.wav"
  };
  
  // Create and store the quote data for later use
  window.currentQuoteData = {
    id: 'music1',
    quote: "A lot of people don't appreciate the moment until it's passed.",
    correctCelebrity: "Ye",
    celebrities: celebrities,
    audioClips: audioFiles
  };
  
  // Update game state to use our quote data
  gameState.currentCategory = "Music";
  gameState.currentQuote = window.currentQuoteData;
  gameState.lastPlayedCategory = "Music";
  
  // Add category to played categories if not already there
  if (!gameState.playedCategories.includes("Music")) {
    gameState.playedCategories.push("Music");
  }
  
  // Update quote text
  if (window.quoteTextElement) {
    window.quoteTextElement.textContent = `"${window.currentQuoteData.quote}"`;
  }
  
  // Update category
  if (window.currentCategoryElement) {
    window.currentCategoryElement.textContent = "Music";
  }
  
  // Create buttons for each celebrity with dark bg and yellow outline
  celebrities.forEach(celeb => {
    const button = document.createElement('button');
    button.className = 'celebrity-button';
    
    // Match the category button styling but with dark background and yellow outline
    button.style.padding = '0.7rem 0.2rem'; // Further reduced padding by ~20%
    button.style.border = '2px solid var(--primary-color, #F5F834)'; // Reduced border thickness
    button.style.borderRadius = 'var(--border-radius, 6px)'; // Smaller border radius
    button.style.backgroundColor = '#121212'; // Dark background
    button.style.color = 'white'; // White text for visibility
    button.style.fontSize = '0.9rem'; // Further reduced font
    button.style.fontWeight = '700';
    button.style.cursor = 'pointer';
    button.style.transition = 'var(--transition, all 0.3s ease)';
    button.style.boxShadow = '0 3px 8px var(--button-shadow, rgba(0, 0, 0, 0.3))'; // Smaller shadow
    button.style.display = 'flex';
    button.style.flexDirection = 'column';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.gap = '0.5rem'; // Further reduced gap
    button.style.position = 'relative';
    button.style.overflow = 'hidden';
    button.style.height = 'auto'; // Allow natural height
    button.style.width = '100%';
    button.style.minHeight = '95px'; // Further reduced from 120px to ~95px
    
    // Add the shine effect (like category buttons)
    const shine = document.createElement('div');
    shine.style.position = 'absolute';
    shine.style.top = '0';
    shine.style.left = '0';
    shine.style.width = '100%';
    shine.style.height = '100%';
    shine.style.background = 'linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.1), transparent)';
    shine.style.transform = 'translateX(-100%)';
    shine.style.transition = '0.6s';
    button.appendChild(shine);
    
    // Add enhanced hover effects
    button.addEventListener('mouseover', () => {
      button.style.transform = 'translateY(-3px)'; // Reduced movement
      button.style.boxShadow = '0 6px 12px var(--button-shadow, rgba(0, 0, 0, 0.4))'; // Smaller shadow
      button.style.borderColor = 'white'; // Highlight border on hover
      shine.style.transform = 'translateX(100%)';
    });
    
    button.addEventListener('mouseout', () => {
      button.style.transform = '';
      button.style.boxShadow = '0 3px 8px var(--button-shadow, rgba(0, 0, 0, 0.3))';
      button.style.borderColor = 'var(--primary-color, #F5F834)';
      shine.style.transform = 'translateX(-100%)';
    });
    
    button.addEventListener('mousedown', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 2px 4px var(--button-shadow, rgba(0, 0, 0, 0.3))';
    });
    
    button.addEventListener('mouseup', () => {
      button.style.transform = 'translateY(-3px)';
      button.style.boxShadow = '0 6px 12px var(--button-shadow, rgba(0, 0, 0, 0.4))';
    });
    
    // Create image element for celebrity - FURTHER REDUCED SIZE
    const imgContainer = document.createElement('div');
    imgContainer.style.width = '70px'; // Further reduced from 70px
    imgContainer.style.height = '70px'; // Further reduced from 70px
    imgContainer.style.borderRadius = '50%';
    imgContainer.style.overflow = 'hidden';
    imgContainer.style.marginBottom = '0.2rem';
    imgContainer.style.backgroundColor = '#333'; // Darker background for placeholders
    imgContainer.style.display = 'flex';
    imgContainer.style.justifyContent = 'center';
    imgContainer.style.alignItems = 'center';
    imgContainer.style.border = '2px solid var(--primary-color, #F5F834)'; // Reduced border thickness
    imgContainer.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)'; // Smaller shadow
    imgContainer.style.transition = 'transform 0.3s ease';
    
    const img = document.createElement('img');
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.alt = celeb;
    
    // Try to load celebrity image
    const imageName = celeb.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    img.src = `celebrity-images/${imageName}.jpg`;
    
    // Add hover effect for image
    button.addEventListener('mouseover', () => {
      imgContainer.style.transform = 'scale(1.1)'; // Reduced scale effect
      imgContainer.style.borderColor = 'white';
    });
    
    button.addEventListener('mouseout', () => {
      imgContainer.style.transform = '';
      imgContainer.style.borderColor = 'var(--primary-color, #F5F834)';
    });
    
    // If image fails to load, use a placeholder with initials
    img.onerror = () => {
      img.style.display = 'none';
      
      // Create a placeholder with initials
      const initials = document.createElement('div');
      initials.style.width = '100%';
      initials.style.height = '100%';
      initials.style.display = 'flex';
      initials.style.justifyContent = 'center';
      initials.style.alignItems = 'center';
      initials.style.backgroundColor = getRandomColor(celeb);
      initials.style.color = 'white';
      initials.style.fontWeight = 'bold';
      initials.style.fontSize = '20px'; // Further reduced from 26px
      
      // Get initials from celebrity name
      const initialsText = celeb
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase();
      
      initials.textContent = initialsText;
      imgContainer.appendChild(initials);
    };
    
    imgContainer.appendChild(img);
    
    // Add name text
    const nameText = document.createElement('span');
    nameText.textContent = celeb;
    nameText.style.textAlign = 'center';
    nameText.style.fontWeight = 'bold';
    nameText.style.maxWidth = '100%';
    nameText.style.overflow = 'hidden';
    nameText.style.textOverflow = 'ellipsis';
    nameText.style.whiteSpace = 'nowrap';
    nameText.style.color = 'white'; // Make sure name is visible on dark bg
    
    // Append elements to button
    button.appendChild(imgContainer);
    button.appendChild(nameText);
    
    // Use the main game flow with our audio files
    button.addEventListener('click', () => selectAnswer(celeb));
    
    container.appendChild(button);
  });
  
  // Start the timer
  startTimer();
  
  // Update timers and other UI
  window.logDiagnostic(`Game ready with ${celebrities.length} celebrities - timer started`);
  return `Added ${celebrities.length} celebrity buttons with dark backgrounds and yellow outlines`;
};

// Add a function to test receiving game data - COMPLETELY REWRITTEN FOR RELIABILITY
window.testReceiveGameData = function() {
  window.logDiagnostic("=== DIRECT GAME START: Running fully rebuilt testReceiveGameData function ===");
  
  // Create a test category
  const category = "Music";
  
  // Create celebrity buttons with real audio paths
  const celebrities = [
    "Drake",
    "John Lennon",
    "Psy",
    "Rick Rubin",
    "Snoop Dogg",
    "Ye"
  ];
  
  // Map of celebrities to their audio files
  const audioFiles = {
    "Drake": "audio/music/drake_music.wav",
    "John Lennon": "audio/music/john-lennon_music.wav",
    "Psy": "audio/music/psy_music.wav",
    "Rick Rubin": "audio/music/rick-rubin_music.wav",
    "Snoop Dogg": "audio/music/snoop-dogg_music.wav",
    "Ye": "audio/music/ye_music.wav"
  };

  // Map of celebrities to their image files
  const imageFiles = {
    "Drake": "assets/celebrities/drake.jpg",
    "John Lennon": "assets/celebrities/john-lennon.jpg",
    "Psy": "assets/celebrities/psy.jpg",
    "Rick Rubin": "assets/celebrities/rick-rubin.jpg",
    "Snoop Dogg": "assets/celebrities/snoop-dogg.jpg",
    "Ye": "assets/celebrities/ye.jpg"
  };
  
  // Create and store the quote data
  const quoteData = {
    id: 'music1',
    quote: "A lot of people don't appreciate the moment until it's passed.",
    correctCelebrity: "Ye",
    celebrities: celebrities,
    audioClips: audioFiles,
    imageFiles: imageFiles
  };
  
  try {
    window.logDiagnostic("Step 1: Removing loading indicator");
    // Remove the loading indicator if it exists
    const loadingIndicator = document.getElementById('initial-loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
    
    window.logDiagnostic("Step 2: Setting up game state");
    // Explicitly set game properties
    gameState.currentCategory = category;
    gameState.currentQuote = quoteData;
    gameState.lastPlayedCategory = category;
    gameState.isPlaying = true;
    gameState.selectedCelebrity = null;
    gameState.timeRemaining = gameState.timerDuration;
    
    window.logDiagnostic("Step 3: Ensuring all required game elements exist");
    
    // Get or create the game container
    let gameContainer = document.getElementById('game-container');
    if (!gameContainer) {
      window.logDiagnostic("Creating missing game container");
      gameContainer = document.createElement('div');
      gameContainer.id = 'game-container';
      gameContainer.style.width = '100%';
      gameContainer.style.height = '100%';
      gameContainer.style.position = 'relative';
      gameContainer.style.zIndex = '5';
      document.body.appendChild(gameContainer);
    }
    
    // Get or create the game play screen
    let gamePlayScreen = document.getElementById('game-play');
    if (!gamePlayScreen) {
      window.logDiagnostic("Creating missing game play screen");
      gamePlayScreen = document.createElement('div');
      gamePlayScreen.id = 'game-play';
      gamePlayScreen.className = 'game-screen';
      gameContainer.appendChild(gamePlayScreen);
    }
    
    // IMPORTANT: First hide all screens to avoid conflicts
    window.logDiagnostic("Step 4: Hiding all screens");
    document.querySelectorAll('.game-screen').forEach(screen => {
      screen.style.display = 'none';
      screen.classList.remove('active');
    });
    
    // Style game play screen for optimal layout
    gamePlayScreen.style.display = 'flex';
    gamePlayScreen.style.flexDirection = 'column';
    gamePlayScreen.style.alignItems = 'center';
    gamePlayScreen.style.padding = '10px';
    gamePlayScreen.style.width = '100%';
    gamePlayScreen.style.boxSizing = 'border-box';
    gamePlayScreen.style.maxHeight = '100vh';
    gamePlayScreen.style.overflowY = 'auto';
    gamePlayScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    gamePlayScreen.classList.add('active');
    
    // Get or create the timer container (at the very top)
    let timerContainer = document.getElementById('timer-container');
    if (!timerContainer) {
      window.logDiagnostic("Creating missing timer container");
      timerContainer = document.createElement('div');
      timerContainer.id = 'timer-container';
      
      // Add timer bar
      const timerBar = document.createElement('div');
      timerBar.id = 'timer-bar';
      timerContainer.appendChild(timerBar);
      
      // Add timer text
      const timerText = document.createElement('div');
      timerText.id = 'timer-text';
      timerContainer.appendChild(timerText);
      
      // Insert at the top of game play screen
      gamePlayScreen.insertBefore(timerContainer, gamePlayScreen.firstChild);
    }
    
    // Style the timer container properly
    timerContainer.style.width = '100%';
    timerContainer.style.height = '10px';
    timerContainer.style.position = 'sticky';
    timerContainer.style.top = '0';
    timerContainer.style.zIndex = '30';
    timerContainer.style.backgroundColor = 'rgba(0,0,0,0.5)';
    timerContainer.style.borderRadius = '5px';
    timerContainer.style.overflow = 'visible';
    timerContainer.style.marginBottom = '15px';
    timerContainer.style.boxShadow = '0 3px 8px rgba(0,0,0,0.3)';
    
    // Get or create the quote container
    let quoteContainer = document.getElementById('quote-container');
    if (!quoteContainer) {
      window.logDiagnostic("Creating missing quote container");
      quoteContainer = document.createElement('div');
      quoteContainer.id = 'quote-container';
      
      // Add heading
      const heading = document.createElement('h2');
      heading.textContent = 'Who said this?';
      quoteContainer.appendChild(heading);
      
      // Add quote text
      const quoteText = document.createElement('div');
      quoteText.id = 'quote-text';
      quoteContainer.appendChild(quoteText);
      
      gamePlayScreen.appendChild(quoteContainer);
    }
    
    // Style the quote container properly
    quoteContainer.style.width = '100%';
    quoteContainer.style.boxSizing = 'border-box';
    quoteContainer.style.padding = '12px';
    quoteContainer.style.backgroundColor = 'rgba(0,0,0,0.5)';
    quoteContainer.style.borderRadius = '8px';
    quoteContainer.style.marginBottom = '12px';
    quoteContainer.style.textAlign = 'center';
    quoteContainer.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
    
    // Get or create the celebrities container
    let celebritiesContainer = document.getElementById('celebrities-container');
    if (!celebritiesContainer) {
      window.logDiagnostic("Creating missing celebrities container");
      celebritiesContainer = document.createElement('div');
      celebritiesContainer.id = 'celebrities-container';
      gamePlayScreen.appendChild(celebritiesContainer);
    }
    
    // Style the celebrities container properly
    celebritiesContainer.style.display = 'grid';
    celebritiesContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
    celebritiesContainer.style.gap = '10px';
    celebritiesContainer.style.width = '100%';
    celebritiesContainer.style.boxSizing = 'border-box';
    celebritiesContainer.style.paddingBottom = '20px';
    celebritiesContainer.style.maxHeight = 'calc(100vh - 170px)';
    celebritiesContainer.style.overflowY = 'auto';
    
    // Get or create category display (even though it's hidden)
    let categoryDisplay = document.getElementById('category-display');
    if (!categoryDisplay) {
      window.logDiagnostic("Creating missing category display");
      categoryDisplay = document.createElement('div');
      categoryDisplay.id = 'category-display';
      categoryDisplay.innerHTML = 'Category: <span id="current-category"></span>';
      gamePlayScreen.appendChild(categoryDisplay);
    }
    
    // Hide category display
    categoryDisplay.style.cssText = 'display: none !important; height: 0 !important; overflow: hidden !important;';
    
    window.logDiagnostic("Step 5: Setting element references");
    
    // Ensure we have references to all key elements
    const quoteTextEl = document.getElementById('quote-text');
    const timerBarEl = document.getElementById('timer-bar');
    const timerTextEl = document.getElementById('timer-text');
    const currentCategoryEl = document.getElementById('current-category');
    
    window.logDiagnostic("Step 6: Applying styles to elements");
    
    // Style the timer bar
    if (timerBarEl) {
      timerBarEl.style.height = '10px';
      timerBarEl.style.borderRadius = '5px';
      timerBarEl.style.backgroundColor = '#F5F834';
      timerBarEl.style.transition = 'width 0.9s linear, background-color 0.3s ease';
      timerBarEl.style.boxShadow = '0 0 8px rgba(245, 248, 52, 0.5)';
      timerBarEl.style.width = '100%';
    }
    
    // Style the timer text
    if (timerTextEl) {
      timerTextEl.style.position = 'absolute';
      timerTextEl.style.top = '-8px';
      timerTextEl.style.right = '10px';
      timerTextEl.style.fontWeight = 'bold';
      timerTextEl.style.fontSize = '20px';
      timerTextEl.style.color = '#F5F834';
      timerTextEl.style.textShadow = '0 0 5px rgba(0,0,0,0.8)';
      timerTextEl.style.padding = '3px 8px';
      timerTextEl.style.background = 'rgba(0,0,0,0.6)';
      timerTextEl.style.borderRadius = '5px';
      timerTextEl.style.zIndex = '31';
      timerTextEl.textContent = gameState.timerDuration.toString();
    }
    
    // Style quote text elements
    if (quoteTextEl) {
      quoteTextEl.textContent = `"${quoteData.quote}"`;
      quoteTextEl.style.fontWeight = 'bold';
      quoteTextEl.style.fontSize = '16px';
      quoteTextEl.style.lineHeight = '1.4';
      quoteTextEl.style.fontStyle = 'italic';
      quoteTextEl.style.color = 'white';
    }
    
    if (currentCategoryEl) {
      currentCategoryEl.textContent = category;
    }
    
    window.logDiagnostic("Step 7: Creating celebrity buttons with images");
    
    // Clear and create celebrity buttons with images
    if (celebritiesContainer) {
      celebritiesContainer.innerHTML = '';
      
      // Create buttons for each celebrity
      celebrities.forEach(celeb => {
        // Create button
        const button = document.createElement('button');
        button.className = 'celebrity-button';
        
        // Style the button
        button.style.padding = '0.7rem 0.2rem';
        button.style.backgroundColor = '#121212';
        button.style.color = 'white';
        button.style.border = '2px solid #F5F834';
        button.style.borderRadius = '6px';
        button.style.cursor = 'pointer';
        button.style.fontWeight = 'bold';
        button.style.fontSize = '0.9rem';
        button.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease';
        button.style.boxShadow = '0 3px 5px rgba(0, 0, 0, 0.3)';
        button.style.display = 'flex';
        button.style.flexDirection = 'column';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.gap = '0.4rem';
        button.style.width = '100%';
        button.style.height = 'auto';
        button.style.minHeight = '90px';
        
        // Create image container
        const imgContainer = document.createElement('div');
        imgContainer.style.width = '70px';
        imgContainer.style.height = '70px';
        imgContainer.style.borderRadius = '12px'; // Changed from 50% to 12px for rounded corners
        imgContainer.style.overflow = 'hidden';
        imgContainer.style.marginBottom = '0.2rem';
        imgContainer.style.backgroundColor = getRandomColor(celeb);
        imgContainer.style.display = 'flex';
        imgContainer.style.justifyContent = 'center';
        imgContainer.style.alignItems = 'center';
        imgContainer.style.border = '2px solid #F5F834';
        imgContainer.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
        imgContainer.style.transition = 'transform 0.2s ease, border-color 0.2s ease';
        
        // Create image element
        const img = document.createElement('img');
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.alt = celeb;
        
        // Get image path from imageFiles map
        const imagePath = imageFiles[celeb];
        img.src = imagePath;
        
        // Log image loading
        window.logDiagnostic(`Setting image for ${celeb}: ${imagePath}`);
        
        // Handle image load error with fallback to initials
        img.onerror = () => {
          window.logDiagnostic(`Image load failed for ${celeb}, using initials fallback`);
          img.style.display = 'none';
          
          // Create initials fallback
          const initials = document.createElement('div');
          initials.style.width = '100%';
          initials.style.height = '100%';
          initials.style.display = 'flex';
          initials.style.justifyContent = 'center';
          initials.style.alignItems = 'center';
          initials.style.color = 'white';
          initials.style.fontWeight = 'bold';
          initials.style.fontSize = '18px';
          
          // Get initials from celebrity name
          const initialsText = celeb
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase();
          
          initials.textContent = initialsText;
          imgContainer.appendChild(initials);
        };
        
        // Add image to container
        imgContainer.appendChild(img);
        
        // Add hover effects
        button.addEventListener('mouseover', () => {
          button.style.transform = 'translateY(-2px)';
          button.style.boxShadow = '0 5px 10px rgba(0, 0, 0, 0.4)';
          button.style.borderColor = 'white';
          imgContainer.style.transform = 'scale(1.1)';
          imgContainer.style.borderColor = 'white';
        });
        
        button.addEventListener('mouseout', () => {
          button.style.transform = '';
          button.style.boxShadow = '0 3px 5px rgba(0, 0, 0, 0.3)';
          button.style.borderColor = '#F5F834';
          imgContainer.style.transform = '';
          imgContainer.style.borderColor = '#F5F834';
        });
        
        // Add name text
        const nameText = document.createElement('span');
        nameText.textContent = celeb;
        nameText.style.textAlign = 'center';
        nameText.style.fontWeight = 'bold';
        nameText.style.fontSize = '0.85rem';
        nameText.style.maxWidth = '100%';
        nameText.style.overflow = 'hidden';
        nameText.style.textOverflow = 'ellipsis';
        nameText.style.whiteSpace = 'nowrap';
        nameText.style.color = 'white';
        
        // Append elements to button
        button.appendChild(imgContainer);
        button.appendChild(nameText);
        
        // Add click handler
        button.onclick = function() {
          window.logDiagnostic(`Button clicked for celebrity: ${celeb}`);
          try {
            selectAnswer(celeb);
          } catch (err) {
            window.logDiagnostic(`Error in selectAnswer: ${err.message}. Using direct showGameResults fallback.`);
            try {
              showGameResults(celeb);
            } catch (fallbackErr) {
              window.logDiagnostic(`Fallback also failed: ${fallbackErr.message}`);
              alert(`Selected: ${celeb}\nCorrect answer: ${quoteData.correctCelebrity}`);
            }
          }
        };
        
        // Add to container
        celebritiesContainer.appendChild(button);
      });
      
      window.logDiagnostic(`Created ${celebrities.length} celebrity buttons with images`);
    }
    
    window.logDiagnostic("Step 8: Initializing audio");
    
    // Initialize audio
    try {
      enableGameAudio();
      
      // Create countdown ticker if it doesn't exist
      if (!countdownTicker) {
        countdownTicker = createCountdownTicking();
      }
    } catch (audioErr) {
      window.logDiagnostic(`Audio initialization error: ${audioErr.message}`);
    }
    
    window.logDiagnostic("Step 9: Starting the timer");
    
    // Reset the timer
    gameState.timeRemaining = gameState.timerDuration;
    if (timerTextEl) timerTextEl.textContent = gameState.timeRemaining.toString();
    if (timerBarEl) timerBarEl.style.width = '100%';
    
    // Reset any existing timer
    if (gameState.timerInterval) {
      clearInterval(gameState.timerInterval);
    }
    
    // Start the timer
    try {
      startTimer();
      window.logDiagnostic("Timer started successfully");
    } catch (timerErr) {
      window.logDiagnostic(`Error starting timer: ${timerErr.message}. Using fallback timer.`);
      
      // Fallback timer in case startTimer fails
      gameState.timerInterval = setInterval(() => {
        gameState.timeRemaining--;
        
        if (timerTextEl) timerTextEl.textContent = gameState.timeRemaining.toString();
        if (timerBarEl) timerBarEl.style.width = `${(gameState.timeRemaining / gameState.timerDuration) * 100}%`;
        
        // Update timer bar color
        if (gameState.timeRemaining <= 5) {
          timerBarEl.style.backgroundColor = '#f44336'; // Red
        } else if (gameState.timeRemaining <= 10) {
          timerBarEl.style.backgroundColor = '#ff9800'; // Orange
        }
        
        // Game over when timer reaches 0
        if (gameState.timeRemaining <= 0) {
          clearInterval(gameState.timerInterval);
          showGameResults(null);
        }
      }, 1000);
      
      window.logDiagnostic("Fallback timer started");
    }
    
    // Ensure game elements have optimal layout
    optimizeGamePlayLayout();
    ensureGameElementsVisible();
    
    window.logDiagnostic("=== Game started successfully using direct method with images ===");
    return true;
  } catch (error) {
    window.logDiagnostic(`CRITICAL ERROR in testReceiveGameData: ${error.message}`);
    console.error("Error in testReceiveGameData:", error);
    
    // Super emergency fallback: create minimal UI showing the error
    try {
      // Remove loading indicator
      const loadingIndicator = document.getElementById('initial-loading-indicator');
      if (loadingIndicator) loadingIndicator.remove();
      
      // Create a minimal game interface
      const emergencyUI = document.createElement('div');
      emergencyUI.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 9999;
        color: white;
        text-align: center;
      `;
      
      emergencyUI.innerHTML = `
        <h2 style="color: #F5F834; margin-bottom: 20px;">Hear Say!? - Emergency Mode</h2>
        <p style="margin-bottom: 15px;">Quote: "${quoteData.quote}"</p>
        <p style="margin-bottom: 30px;">Who said this?</p>
        <div id="emergency-buttons" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; width: 100%; max-width: 400px;"></div>
      `;
      
      document.body.appendChild(emergencyUI);
      
      // Add buttons
      const buttonsContainer = document.getElementById('emergency-buttons');
      celebrities.forEach(celeb => {
        const button = document.createElement('button');
        button.textContent = celeb;
        button.style.cssText = `
          padding: 10px;
          background-color: #121212;
          color: white;
          border: 2px solid #F5F834;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
        `;
        
        button.onclick = () => {
          const isCorrect = celeb === quoteData.correctCelebrity;
          alert(`${isCorrect ? 'CORRECT!' : 'INCORRECT!'}\n\nThe quote was said by: ${quoteData.correctCelebrity}`);
          emergencyUI.remove();
          
          // Try to show category screen
          const categoryScreen = document.getElementById('category-select');
          if (categoryScreen) {
            document.querySelectorAll('.game-screen').forEach(screen => {
              screen.style.display = 'none';
            });
            categoryScreen.style.display = 'flex';
          }
        };
        
        buttonsContainer.appendChild(button);
      });
      
      window.logDiagnostic("Emergency UI displayed");
    } catch (emergencyError) {
      // Last resort - just alert
      alert(`Error: ${error.message}\n\nQuote: "${quoteData.quote}"\nCorrect answer: ${quoteData.correctCelebrity}`);
    }
    
    return false;
  }
};

// Add a function to test audio playback directly
window.testAudioPlayback = function() {
  // Initialize audio context if needed
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (err) {
      console.log('Failed to create audio context:', err);
    }
  }
  
  // Small notification
  const notification = document.createElement('div');
  notification.style.position = 'fixed';
  notification.style.top = '60px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.backgroundColor = '#2196f3';
  notification.style.color = 'white';
  notification.style.padding = '8px 12px';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '9999';
  notification.style.fontSize = '14px';
  notification.style.fontWeight = 'bold';
  notification.textContent = 'Testing audio...';
  document.body.appendChild(notification);

  // Test with Bono's audio
  const audioPath = 'audio/music/bono_music.mp3';
  const testAudio = new Audio(audioPath);
  
  // Play with proper error handling
  testAudio.play()
            .then(() => {
      notification.textContent = 'Audio playing!';
      notification.style.backgroundColor = '#4caf50';
      
      // Remove notification after audio finishes or timeout
      testAudio.onended = () => notification.remove();
      setTimeout(() => notification.remove(), 5000);
    })
    .catch(err => {
      notification.textContent = `Audio error: ${err.message}`;
      notification.style.backgroundColor = '#f44336';
      setTimeout(() => notification.remove(), 3000);
    });
};

// Create buttons for each celebrity from quote data
function createButtonsFromQuoteData(quoteData) {
  // Get celebrities container, either from window variable or direct DOM access
  let containerEl = celebritiesContainer || document.getElementById('celebrities-container');
  
  if (!containerEl) {
    console.error('Cannot find celebrities container');
    window.logDiagnostic("ERROR: Cannot find celebrities container - trying to create one");
    
    // Try to find or create a container
    const gamePlayEl = gamePlayScreen || document.getElementById('game-play');
    if (gamePlayEl) {
      containerEl = document.createElement('div');
      containerEl.id = 'celebrities-container';
      containerEl.style.padding = '0';
      containerEl.style.margin = '5px 0';
      containerEl.style.width = '100%';
      
      // Add to game play screen
      gamePlayEl.appendChild(containerEl);
      
      // Update references
      celebritiesContainer = containerEl;
      window.celebritiesContainer = containerEl;
      window.logDiagnostic("Created new celebrities container");
    } else {
      window.logDiagnostic("CRITICAL ERROR: Cannot create container - game play screen not found");
      return;
    }
  }
  
  // Clear previous content
  containerEl.innerHTML = '';
  
  // Get the list of celebrities from the quote data
  const celebrities = quoteData.celebrities || [];
  window.logDiagnostic(`Creating buttons for ${celebrities.length} celebrities`);
  
  // Style the celebrities container to match the category-container
  containerEl.style.display = 'grid';
  containerEl.style.gridTemplateColumns = 'repeat(2, 1fr)';
  containerEl.style.gap = '0.6rem'; // Further reduced gap
  containerEl.style.width = '100%';
  containerEl.style.margin = '8px 0 0 0'; // Added top margin to separate from quote
  containerEl.style.padding = '0';
  containerEl.style.border = 'none';
  containerEl.style.boxSizing = 'border-box';
  containerEl.style.maxHeight = 'calc(100vh - 150px)'; // Limit height to ensure it fits in viewport
  containerEl.style.overflowY = 'auto'; // Allow scrolling if needed
  
  // Create a button for each celebrity
  celebrities.forEach(celebrity => {
    try {
      const button = document.createElement('button');
      button.className = 'celebrity-button';
      
      // Match the category button styling but with dark background and yellow outline
      button.style.padding = '0.7rem 0.2rem'; // Further reduced padding
      button.style.border = '2px solid var(--primary-color, #F5F834)';
      button.style.borderRadius = 'var(--border-radius, 6px)';
      button.style.backgroundColor = '#121212'; // Dark background
      button.style.color = 'white'; // White text for visibility
      button.style.fontSize = '0.9rem';
      button.style.fontWeight = '700';
      button.style.cursor = 'pointer';
      button.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease';
      button.style.boxShadow = '0 3px 5px rgba(0, 0, 0, 0.3)';
      button.style.display = 'flex';
      button.style.flexDirection = 'column';
      button.style.alignItems = 'center';
      button.style.justifyContent = 'center';
      button.style.gap = '0.4rem';
      button.style.position = 'relative';
      button.style.overflow = 'hidden';
      button.style.width = '100%';
      button.style.height = 'auto';
      button.style.minHeight = '90px'; // Reduced height
      
      // Create image container
      const imgContainer = document.createElement('div');
      imgContainer.style.width = '70px';
      imgContainer.style.height = '70px';
      imgContainer.style.borderRadius = '12px'; // Changed from 50% to 12px for rounded corners
      imgContainer.style.overflow = 'hidden';
      imgContainer.style.marginBottom = '0.2rem';
      imgContainer.style.backgroundColor = getRandomColor(celebrity); // Fallback background color
      imgContainer.style.display = 'flex';
      imgContainer.style.justifyContent = 'center';
      imgContainer.style.alignItems = 'center';
      imgContainer.style.border = '2px solid var(--primary-color, #F5F834)';
      imgContainer.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
      imgContainer.style.transition = 'transform 0.2s ease, border-color 0.2s ease';
      
      // Create the image element
      const img = document.createElement('img');
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.alt = celebrity;
      
      // Create clean filename for the image - handle special characters and spaces
      const imageFilename = celebrity.toLowerCase()
        .replace(/é/g, 'e')   // Replace é with e
        .replace(/[^\w\s-]/g, '') // Remove any other special characters
        .replace(/\s+/g, '-')     // Replace spaces with hyphens
        .trim();
      
      // Set the image source using the assets/celebrities directory
      img.src = `assets/celebrities/${imageFilename}.jpg`;
      
      // Log the image path for debugging
      window.logDiagnostic(`Setting image path: ${img.src} for ${celebrity}`);
      
      // If image fails to load, create a fallback with initials
      img.onerror = () => {
        window.logDiagnostic(`Image load failed for ${celebrity}, using initials fallback`);
        img.style.display = 'none';
        
        // Create a fallback with initials
        const initials = document.createElement('div');
        initials.style.width = '100%';
        initials.style.height = '100%';
        initials.style.display = 'flex';
        initials.style.justifyContent = 'center';
        initials.style.alignItems = 'center';
        initials.style.color = 'white';
        initials.style.fontWeight = 'bold';
        initials.style.fontSize = '18px';
        
        // Get initials from celebrity name
        const initialsText = celebrity
          .split(' ')
          .map(word => word.charAt(0))
          .join('')
          .toUpperCase();
        
        initials.textContent = initialsText;
        imgContainer.appendChild(initials);
      };
      
      // Add the image to its container
      imgContainer.appendChild(img);
      
      // Add enhanced hover effects
      button.addEventListener('mouseover', () => {
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 5px 10px rgba(0, 0, 0, 0.4)';
        button.style.borderColor = 'white';
        imgContainer.style.transform = 'scale(1.1)';
        imgContainer.style.borderColor = 'white';
      });
      
      button.addEventListener('mouseout', () => {
        button.style.transform = '';
        button.style.boxShadow = '0 3px 5px rgba(0, 0, 0, 0.3)';
        button.style.borderColor = 'var(--primary-color, #F5F834)';
        imgContainer.style.transform = '';
        imgContainer.style.borderColor = 'var(--primary-color, #F5F834)';
      });
      
      // Add name text
      const nameText = document.createElement('span');
      nameText.textContent = celebrity;
      nameText.style.textAlign = 'center';
      nameText.style.fontWeight = 'bold';
      nameText.style.maxWidth = '100%';
      nameText.style.overflow = 'hidden';
      nameText.style.textOverflow = 'ellipsis';
      nameText.style.whiteSpace = 'nowrap';
      nameText.style.color = 'white';
      nameText.style.fontSize = '0.85rem';
      
      // Append elements to button
      button.appendChild(imgContainer);
      button.appendChild(nameText);
      
      // Create a direct onclick handler to ensure it works
      button.onclick = function() {
        console.log(`Button clicked for ${celebrity}`);
        window.logDiagnostic(`Button clicked for ${celebrity}`);
        selectAnswer(celebrity);
      };
      
      // Add to container
      containerEl.appendChild(button);
      
      window.logDiagnostic(`Created button for ${celebrity}`);
    } catch (error) {
      console.error(`Error creating button for ${celebrity}:`, error);
      window.logDiagnostic(`ERROR: Failed to create button for ${celebrity}: ${error.message}`);
    }
  });
  
  window.logDiagnostic(`Created ${celebrities.length} celebrity buttons`);
  return containerEl;
}

// Helper function to generate a deterministic color based on name
function getRandomColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

// Reset the timer
function resetTimer() {
  // Reset the timer values
  gameState.timeRemaining = gameState.timerDuration;
  
  // Update UI
  if (timerTextElement) {
    timerTextElement.textContent = gameState.timeRemaining.toString();
  }
  
  if (timerBarElement) {
    timerBarElement.style.width = '100%';
  }
  
  // Clear any existing interval
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }
  
  window.logDiagnostic("Timer reset");
}

// Helper function to ensure category buttons are properly set up
function setupCategoryButtons() {
  // Get all category buttons
  const categoryButtons = document.querySelectorAll('.category-button');
  
  if (!categoryButtons || categoryButtons.length === 0) {
    console.error("No category buttons found!");
    return false;
  }
  
  // Add event listener to each button
  categoryButtons.forEach(button => {
    const category = button.getAttribute('data-category');
    
    // Add event listener - When a category is clicked, notify the parent frame
    button.addEventListener('click', () => {
      console.log(`Category selected: ${category}`);
      
      // Add a visual indicator
      categoryButtons.forEach(btn => btn.classList.remove('selected'));
      button.classList.add('selected');
      
      // Trigger the pulse animation
      button.classList.add('pulse-animation');
      setTimeout(() => button.classList.remove('pulse-animation'), 500);
      
      // Send message to Devvit
      sendMessage({
        type: 'categorySelected',
        data: { category }
      });
    });
  });
  
  return true;
}

// Emergency repair function for broken category screen
function repairCategoryScreen() {
  window.logDiagnostic("Attempting emergency repair of category screen");
  
  // Check if the category select screen exists
  let categoryScreen = document.getElementById('category-select');
  
  if (!categoryScreen) {
    window.logDiagnostic("Category screen not found - creating new one");
    
    // Create a new category screen
    categoryScreen = document.createElement('div');
    categoryScreen.id = 'category-select';
    categoryScreen.className = 'game-screen';
    
    // Create category container
    const categoryContainer = document.createElement('div');
    categoryContainer.className = 'category-container';
    
    // Add category buttons
    const categories = ["Music", "Politics", "Movies", "History", "Sports", "Academia"];
    categories.forEach(category => {
      const button = document.createElement('button');
      button.className = 'category-button';
      button.setAttribute('data-category', category);
      button.textContent = category;
      categoryContainer.appendChild(button);
    });
    
    categoryScreen.appendChild(categoryContainer);
    
    // Add leaderboard button
    const leaderboardButton = document.createElement('button');
    leaderboardButton.id = 'show-leaderboard';
    leaderboardButton.className = 'secondary-button';
    leaderboardButton.textContent = 'View Leaderboard';
    categoryScreen.appendChild(leaderboardButton);
    
    // Add to game container
    const gameContainer = document.getElementById('game-container');
    
    if (gameContainer) {
      // Find appropriate place to insert - after the header
      const h3Elements = gameContainer.querySelectorAll('h3');
      if (h3Elements.length > 0) {
        const lastH3 = h3Elements[h3Elements.length - 1];
        gameContainer.insertBefore(categoryScreen, lastH3.nextSibling);
      } else {
        // Just add to beginning of game container
        gameContainer.prepend(categoryScreen);
      }
      
      window.logDiagnostic("Emergency category screen created and added to DOM");
    } else {
      window.logDiagnostic("CRITICAL ERROR: Game container not found!");
      return false;
    }
  } else {
    window.logDiagnostic("Category screen found - repairing");
    
    // Ensure it has the correct class
    categoryScreen.className = 'game-screen';
    
    // Check if it has category buttons
    const categoryButtons = categoryScreen.querySelectorAll('.category-button');
    if (!categoryButtons || categoryButtons.length === 0) {
      window.logDiagnostic("No category buttons found - adding them");
      
      // Find or create category container
      let categoryContainer = categoryScreen.querySelector('.category-container');
      if (!categoryContainer) {
        categoryContainer = document.createElement('div');
        categoryContainer.className = 'category-container';
        
        // Add after heading
        const heading = categoryScreen.querySelector('h2');
        if (heading) {
          categoryScreen.insertBefore(categoryContainer, heading.nextSibling);
        } else {
          categoryScreen.prepend(categoryContainer);
        }
      }
      
      // Add category buttons
      const categories = ["Music", "Politics", "Movies", "History", "Sports", "Academia"];
      categories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'category-button';
        button.setAttribute('data-category', category);
        button.textContent = category;
        categoryContainer.appendChild(button);
      });
    }
    
    // Check if it has the leaderboard button
    if (!categoryScreen.querySelector('#show-leaderboard')) {
      window.logDiagnostic("No leaderboard button found - adding it");
      
      const leaderboardButton = document.createElement('button');
      leaderboardButton.id = 'show-leaderboard';
      leaderboardButton.className = 'secondary-button';
      leaderboardButton.textContent = 'View Leaderboard';
      categoryScreen.appendChild(leaderboardButton);
    }
  }
  
  // Update the window reference
  window.categorySelectScreen = categoryScreen;
  
  // Set up event listeners
  setupCategoryButtons();
  
  // Set up leaderboard button
  const leaderboardButton = categoryScreen.querySelector('#show-leaderboard');
  if (leaderboardButton) {
    leaderboardButton.addEventListener('click', () => {
      window.logDiagnostic("Show Leaderboard button clicked (repaired)");
      sendMessage({
        type: 'requestLeaderboard'
      });
      updateLeaderboard();
      showScreen(leaderboardScreen || document.getElementById('leaderboard-screen'));
    });
  }
  
  window.logDiagnostic("Emergency repair of category screen complete");
  return categoryScreen;
}

// Ensure background is properly displayed in Devvit blocks
function ensureBackgroundVisible() {
  // Check if the background wrapper exists
  let backgroundWrapper = document.getElementById('background-wrapper');
  
  // If it doesn't exist, create it
  if (!backgroundWrapper) {
    backgroundWrapper = document.createElement('div');
    backgroundWrapper.id = 'background-wrapper';
    backgroundWrapper.style.position = 'fixed';
    backgroundWrapper.style.top = '0';
    backgroundWrapper.style.left = '0';
    backgroundWrapper.style.width = '100%';
    backgroundWrapper.style.height = '100%';
    backgroundWrapper.style.zIndex = '-1';
    backgroundWrapper.style.backgroundColor = '#121212'; // Dark background as fallback
    backgroundWrapper.style.backgroundSize = 'cover';
    backgroundWrapper.style.backgroundPosition = 'center';
    backgroundWrapper.style.backgroundRepeat = 'no-repeat';
    backgroundWrapper.style.backgroundAttachment = 'fixed';
    backgroundWrapper.style.pointerEvents = 'none';
    
    // Insert at the beginning of the body
    document.body.insertBefore(backgroundWrapper, document.body.firstChild);
    
    window.logDiagnostic("Created background wrapper");
  }

  // Set the correct background image path
  backgroundWrapper.style.backgroundImage = "url('assets/hearsay-bg.png')";
  
  // Force the background image to be visible by setting important flag
  backgroundWrapper.setAttribute('style', backgroundWrapper.getAttribute('style') + '; background-image: url("assets/hearsay-bg.png") !important');
  
  window.logDiagnostic("Set background image to assets/hearsay-bg.png with !important flag");
  
  // Remove any override styles that might be using gradients
  const styleElement = document.querySelector('style#bg-override-styles');
  if (styleElement) {
    styleElement.remove();
    window.logDiagnostic("Removed overriding background style element");
  }
  
  // Add a new style element to ensure background image is visible
  const newStyle = document.createElement('style');
  newStyle.id = 'bg-fix-styles';
  newStyle.textContent = `
    #background-wrapper {
      background-image: url('assets/hearsay-bg.png') !important;
      background-color: #121212 !important;
      background-size: cover !important;
      background-position: center !important;
      background-repeat: no-repeat !important;
      background-attachment: fixed !important;
      opacity: 1 !important;
      visibility: visible !important;
      display: block !important;
    }
    body {
      background-color: transparent !important;
    }
  `;
  document.head.appendChild(newStyle);
  window.logDiagnostic("Added style element to force background image visibility");
  
  // Ensure the body has the right styles
  document.body.style.backgroundColor = 'transparent';
  document.body.style.position = 'relative';
  
  // Ensure the game container has the right styles
  const gameContainer = document.getElementById('game-container');
  if (gameContainer) {
    gameContainer.style.backgroundColor = 'transparent';
    gameContainer.style.position = 'relative';
    gameContainer.style.zIndex = '1';
  }
  
  window.logDiagnostic("Background visibility ensured");
}

// Simplified function to handle celebrity click
function handleCelebrityClick(celebrity) {
  // Check if the game is still running
  if (!gameState.isPlaying) return;
  
  // Store the selected celebrity
  gameState.selectedCelebrity = celebrity;
  
  // Stop the timer
  clearInterval(gameState.timerInterval);
  
  // Check if the answer is correct
  const isCorrect = celebrity === gameState.currentQuote.correctCelebrity;
  
  // Calculate score
  const pointsEarned = calculatePoints(isCorrect);
  
  // Update the total score if correct
  if (isCorrect) {
    gameState.score += pointsEarned;
    scoreElement.textContent = gameState.score;
  }
  
  // Show the result
  showResult(isCorrect, pointsEarned);
  
  // Send the result to the blocks view
  sendMessage({
    type: 'quoteAnswered',
    data: {
      category: gameState.currentCategory,
      quote: gameState.currentQuote.quote,
      selected: celebrity,
      correct: isCorrect,
      score: pointsEarned
    }
  });
}

// Clean up the background initialization
function initializeBackground() {
  const backgroundWrapper = document.getElementById('background-wrapper');
  if (backgroundWrapper) {
    // Set the background image instead of a gradient
    backgroundWrapper.style.backgroundImage = "url('assets/hearsay-bg.png')";
    backgroundWrapper.style.backgroundSize = "cover";
    backgroundWrapper.style.backgroundPosition = "center";
    backgroundWrapper.style.backgroundRepeat = "no-repeat";
    backgroundWrapper.style.backgroundAttachment = "fixed";
    
    // Add !important to ensure the image is displayed
    backgroundWrapper.setAttribute('style', backgroundWrapper.getAttribute('style') + '; background-image: url("assets/hearsay-bg.png") !important');
    
    window.logDiagnostic("Background image re-initialized in initializeBackground");
  }
}

// Add a diagnostic function that will run automatically
window.verifyAudioFiles = function() {
  window.logDiagnostic("Verifying audio files...");
  
  // Array of celebrities to check
  const celebsToCheck = ["Bono", "Taylor Swift", "Beyoncé", "John Lennon", "Bob Dylan", "Lady Gaga"];
  
  // Results container for diagnostics
  const results = [];
  
  // Check each celebrity
  celebsToCheck.forEach(celeb => {
    // Generate file path
    const fileName = celeb.toLowerCase().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const path = `audio/music/${fileName}_music.mp3`;
    
    // Create a test audio element
    const testAudio = new Audio(path);
    
    // Check if the file loads
    testAudio.addEventListener('canplaythrough', () => {
      results.push(`✓ ${celeb}: ${path} - File loaded successfully`);
      window.logDiagnostic(`✓ ${celeb} audio loaded successfully`);
      
      // If all checks are complete, log results
      if (results.length === celebsToCheck.length) {
        logAudioResults(results);
      }
    }, { once: true });
    
    // Check for errors
    testAudio.addEventListener('error', () => {
      const error = testAudio.error ? testAudio.error.message : 'Unknown error';
      results.push(`✗ ${celeb}: ${path} - Error: ${error}`);
      window.logDiagnostic(`✗ ${celeb} audio error: ${error}`);
      
      // If all checks are complete, log results
      if (results.length === celebsToCheck.length) {
        logAudioResults(results);
      }
    }, { once: true });
    
    // Force load attempt
    testAudio.load();
  });
  
  // Log the results after a timeout if not all files reported back
  setTimeout(() => {
    if (results.length < celebsToCheck.length) {
      const remaining = celebsToCheck.length - results.length;
      results.push(`⚠ ${remaining} file(s) did not report back in time`);
      logAudioResults(results);
    }
  }, 5000);
  
  // Helper function to log results
  function logAudioResults(results) {
    console.log("Audio File Verification Results:");
    results.forEach(result => console.log(result));
    
    window.logDiagnostic(`Audio verification complete: ${results.filter(r => r.startsWith('✓')).length}/${celebsToCheck.length} files OK`);
    
    // If any errors, provide more diagnostic info
    if (results.some(r => r.startsWith('✗'))) {
      window.logDiagnostic("⚠ Some audio files failed to load. Check paths or CORS issues.");
    }
  }
};

// Start the timer
function startTimer() {
  console.log('Starting timer...');
  window.logDiagnostic('Starting game timer');
  
  // Reset the timer
  gameState.timeRemaining = gameState.timerDuration;
  timerTextElement.textContent = gameState.timeRemaining.toString();
  timerBarElement.style.width = '100%';
  
  // Set the initial color for the timer bar
  timerBarElement.style.backgroundColor = 'var(--primary-color, #F5F834)'; // Start with yellow
  
  // Enhanced styles for the timer text to make it more prominent
  timerTextElement.style.fontSize = '20px'; // Larger font size
  timerTextElement.style.fontWeight = 'bold';
  timerTextElement.style.color = 'var(--primary-color, #F5F834)';
  timerTextElement.style.textShadow = '0 0 5px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)'; // Stronger glow
  timerTextElement.style.transition = 'all 0.3s ease'; // Smooth transitions for effects
  
  // Add a pulsing animation for the timer text
  const pulseStyle = document.createElement('style');
  pulseStyle.textContent = `
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
    @keyframes colorShift {
      0% { color: #F5F834; }
      50% { color: #FF9800; }
      100% { color: #F44336; }
    }
    @keyframes timerFlash {
      0% { opacity: 1; }
      50% { opacity: 0.7; }
      100% { opacity: 1; }
    }
  `;
  document.head.appendChild(pulseStyle);
  
  // Clear any existing interval
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
  }
  
  // Make sure audio is enabled
  enableGameAudio();
  
  // Initialize the countdown ticker if it doesn't exist or recreate it
  if (!countdownTicker) {
    console.log('Creating new countdown ticker in startTimer');
    countdownTicker = createCountdownTicking();
  } else {
    console.log('Using existing countdown ticker');
  }
  
  // Start the countdown ticking sound
  if (countdownTicker) {
    console.log('Starting countdown ticking');
    countdownTicker.start();
  } else {
    console.error('No countdown ticker available!');
    // Try one more time to create it
    setTimeout(() => {
      countdownTicker = createCountdownTicking();
      if (countdownTicker) {
        console.log('Created countdown ticker on second attempt');
        countdownTicker.start();
      }
    }, 500);
  }
  
  // Add a container for a circular timer animation
  const timerContainer = document.getElementById('timer-container');
  if (timerContainer) {
    // Add outer circle animation
    const circleTimer = document.createElement('div');
    circleTimer.id = 'circle-timer';
    circleTimer.style.position = 'absolute';
    circleTimer.style.top = '-30px';
    circleTimer.style.right = '-30px';
    circleTimer.style.width = '60px';
    circleTimer.style.height = '60px';
    circleTimer.style.borderRadius = '50%';
    circleTimer.style.border = '3px solid var(--primary-color, #F5F834)';
    circleTimer.style.borderTopColor = 'transparent';
    circleTimer.style.animation = 'spin 2s linear infinite';
    circleTimer.style.opacity = '0.7';
    circleTimer.style.display = 'none'; // Will show during critical time
    
    timerContainer.style.position = 'relative'; // Ensure relative position for absolute children
    timerContainer.appendChild(circleTimer);
    
    // Add the spin animation if not already defined
    if (!document.querySelector('style#spin-timer-anim')) {
      const spinStyle = document.createElement('style');
      spinStyle.id = 'spin-timer-anim';
      spinStyle.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(spinStyle);
    }
  }
  
  // Start a new interval with enhanced visual effects
  gameState.timerInterval = setInterval(() => {
    gameState.timeRemaining--;
    
    // Calculate the percentage of time remaining
    const timePercent = (gameState.timeRemaining / gameState.timerDuration) * 100;
    
    // Update the timer display with a smooth transition
    timerTextElement.textContent = gameState.timeRemaining.toString();
    timerBarElement.style.width = `${timePercent}%`;
    
    // Create a color gradient based on time remaining
    let r, g, b;
    if (timePercent > 66) {
      // Green to Yellow transition (first third)
      r = Math.floor(255 * (3 - timePercent/33.3));
      g = 248;
      b = 52;
    } else if (timePercent > 33) {
      // Yellow to Orange transition (middle third)
      r = 255;
      g = Math.floor(248 * ((timePercent - 33) / 33.3));
      b = 52 * ((timePercent - 33) / 33.3);
    } else {
      // Orange to Red transition (final third)
      r = 255;
      g = Math.floor(165 * (timePercent / 33.3));
      b = 0;
    }
    
    // Update the timer bar color
    timerBarElement.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    timerBarElement.style.boxShadow = `0 0 ${10 - gameState.timeRemaining/2}px rgba(${r}, ${g}, ${b}, 0.7)`;
    
    // Apply visual effects based on time remaining
    if (gameState.timeRemaining <= 5) {
      // Critical time - red pulsing and flashing
      timerTextElement.style.color = '#F44336';
      timerTextElement.style.animation = 'pulse 0.5s infinite, colorShift 1s infinite, timerFlash 0.5s infinite';
      timerTextElement.style.fontSize = '24px';
      
      // Show and animate the circle timer during critical time
      const circleTimer = document.getElementById('circle-timer');
      if (circleTimer) {
        circleTimer.style.display = 'block';
        circleTimer.style.borderColor = '#F44336';
        circleTimer.style.borderTopColor = 'transparent';
        circleTimer.style.animation = 'spin 1s linear infinite';
      }
      
      // Add warning background flash to the timer container
      const timerContainer = document.getElementById('timer-container');
      if (timerContainer) {
        timerContainer.style.backgroundColor = `rgba(244, 67, 54, ${0.3 + Math.sin(Date.now() / 200) * 0.2})`; // Pulsing red background
      }
    } else if (gameState.timeRemaining <= 10) {
      // Warning time - orange pulse
      timerTextElement.style.color = '#FF9800';
      timerTextElement.style.animation = 'pulse 1s infinite';
      timerTextElement.style.fontSize = '22px';
      
      // Show the circle timer in warning mode
      const circleTimer = document.getElementById('circle-timer');
      if (circleTimer) {
        circleTimer.style.display = 'block';
        circleTimer.style.borderColor = '#FF9800';
        circleTimer.style.borderTopColor = 'transparent';
        circleTimer.style.animation = 'spin 1.5s linear infinite';
      }
    } else {
      // Normal time
      timerTextElement.style.color = 'var(--primary-color, #F5F834)';
      timerTextElement.style.animation = 'none';
      timerTextElement.style.fontSize = '20px';
      
      // Hide the circle timer in normal mode
      const circleTimer = document.getElementById('circle-timer');
      if (circleTimer) {
        circleTimer.style.display = 'none';
      }
      
      // Reset background color
      const timerContainer = document.getElementById('timer-container');
      if (timerContainer) {
        timerContainer.style.backgroundColor = 'rgba(0,0,0,0.3)';
      }
    }
    
    // Add number drop-in animation when the number changes
    timerTextElement.style.transform = 'translateY(-2px)';
    setTimeout(() => {
      timerTextElement.style.transform = 'translateY(0)';
    }, 150);
    
    // Check if time is up
    if (gameState.timeRemaining <= 0) {
      clearInterval(gameState.timerInterval);
      
      // Stop the ticking sound
      if (countdownTicker) {
        countdownTicker.stop();
      }
      
      // Final flash effect for time's up
      const finalFlash = document.createElement('div');
      finalFlash.style.position = 'fixed';
      finalFlash.style.top = '0';
      finalFlash.style.left = '0';
      finalFlash.style.width = '100%';
      finalFlash.style.height = '100%';
      finalFlash.style.backgroundColor = 'rgba(244, 67, 54, 0.3)';
      finalFlash.style.zIndex = '9998';
      finalFlash.style.animation = 'timerFlash 0.5s';
      finalFlash.style.pointerEvents = 'none';
      document.body.appendChild(finalFlash);
      
      // Remove the flash after animation completes
      setTimeout(() => {
        if (document.body.contains(finalFlash)) {
          document.body.removeChild(finalFlash);
        }
      }, 500);
      
      // Time's up, user didn't select an answer
      endGame(null);
    }
  }, 1000);
}

// Create a ticking countdown sound that speeds up as time runs low
function createCountdownTicking() {
  try {
    // Make sure we have audio context
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (err) {
        console.error('Failed to create audio context for countdown:', err);
        window.logDiagnostic(`Failed to create audio context for countdown: ${err.message}`);
        return null;
      }
    }
    
    let tickInterval = null;
    let ticksPlayed = 0;
    let lastTickTime = 5; // Starting threshold for ticks (every 5 seconds)
    
    // Create a function to play a single tick sound
    const playTick = () => {
      try {
        console.log(`Playing tick sound, remaining time: ${gameState.timeRemaining}`);
        
        // Create oscillator for the tick sound
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Configure sound properties based on remaining time
        if (gameState.timeRemaining <= 5) {
          // Critical time - higher pitch, louder, shorter ticks
          oscillator.type = 'square'; // Harsher sound for urgency
          oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // Higher pitch (A5)
          
          // Louder with quick attack and decay
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.6, audioContext.currentTime + 0.01);
          gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.08);
          
          // Add visual beat to match the sound
          timerTextElement.style.transform = 'scale(1.15)';
          setTimeout(() => {
            timerTextElement.style.transform = 'scale(1)';
          }, 100);
        } else if (gameState.timeRemaining <= 10) {
          // Warning time - medium pitch, moderate volume
          oscillator.type = 'triangle'; // Softer than square but still noticeable
          oscillator.frequency.setValueAtTime(660, audioContext.currentTime); // E5
          
          // Moderate volume
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.01);
          gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
          
          // Subtle visual beat
          timerTextElement.style.transform = 'scale(1.1)';
          setTimeout(() => {
            timerTextElement.style.transform = 'scale(1)';
          }, 100);
        } else {
          // Normal time - lower pitch, softer sound
          oscillator.type = 'sine'; // Softer sound
          oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
          
          // Lower volume
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
          gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
        }
        
        // Connect and play
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Start and stop the oscillator
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
        
      } catch (err) {
        console.error('Error playing tick sound:', err);
        window.logDiagnostic(`Error playing tick sound: ${err.message}`);
      }
    };
    
    // Start playing ticks at intervals that speed up as time goes by
    const startTicking = () => {
      // Clear any existing interval
      stopTicking();
      
      // Reset counters
      ticksPlayed = 0;
      lastTickTime = 5;
      
      // Play ticks at dynamically calculated intervals
      tickInterval = setInterval(() => {
        // Calculate when to play ticks based on remaining time
        if (gameState.timeRemaining <= 0) {
          // Stop ticking if time is up
          stopTicking();
          return;
        }
        
        // Determine if we should play a tick
        let shouldTick = false;
        
        if (gameState.timeRemaining <= 5) {
          // Play every second when 5 or fewer seconds remain
          shouldTick = true;
        } else if (gameState.timeRemaining <= 10) {
          // Play every 2 seconds when 6-10 seconds remain
          shouldTick = (gameState.timeRemaining % 2 === 0);
        } else {
          // Play every 5 seconds otherwise
          shouldTick = (gameState.timeRemaining % 5 === 0);
        }
        
        // Play the tick if conditions are met
        if (shouldTick && gameState.timeRemaining > 0) {
          playTick();
          ticksPlayed++;
        }
      }, 500); // Check twice per second for better accuracy
      
      window.logDiagnostic("Countdown ticking started");
      return tickInterval;
    };
    
    // Stop the ticking
    const stopTicking = () => {
      if (tickInterval) {
        clearInterval(tickInterval);
        tickInterval = null;
        window.logDiagnostic("Countdown ticking stopped");
      }
    };
    
    return {
      start: startTicking,
      stop: stopTicking,
      tick: playTick // Expose single tick for testing
    };
  } catch (err) {
    console.error('Error setting up countdown ticking:', err);
    window.logDiagnostic(`Error setting up countdown ticking: ${err.message}`);
    return null;
  }
}

// Helper function to ensure game elements are visible
function ensureGameElementsVisible() {
  window.logDiagnostic("Running ensureGameElementsVisible to optimize visibility");
  
  // First, optimize the overall game-play screen
  const gamePlayScreen = document.getElementById('game-play');
  if (gamePlayScreen) {
    gamePlayScreen.style.display = 'flex';
    gamePlayScreen.style.flexDirection = 'column';
    gamePlayScreen.style.alignItems = 'center';
    gamePlayScreen.style.padding = '10px';
    gamePlayScreen.style.width = '100%';
    gamePlayScreen.style.boxSizing = 'border-box';
    gamePlayScreen.style.maxHeight = '100vh';
    gamePlayScreen.style.overflowY = 'auto';
    gamePlayScreen.style.position = 'relative';
    gamePlayScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  }
  
  // Ensure the timer is visible at the top
  const timerContainer = document.getElementById('timer-container');
  if (timerContainer) {
    // First ensure timer container is at the very top
    if (gamePlayScreen && gamePlayScreen.firstChild !== timerContainer) {
      gamePlayScreen.insertBefore(timerContainer, gamePlayScreen.firstChild);
      window.logDiagnostic("Moved timer to top of game screen");
    }
    
    // Then style the timer container
    timerContainer.style.width = '100%';
    timerContainer.style.height = '10px';
    timerContainer.style.position = 'sticky'; // Make it stick to top when scrolling
    timerContainer.style.top = '0';
    timerContainer.style.zIndex = '30'; // Higher z-index to ensure visibility
    timerContainer.style.backgroundColor = 'rgba(0,0,0,0.5)';
    timerContainer.style.padding = '0';
    timerContainer.style.borderRadius = '5px';
    timerContainer.style.overflow = 'visible'; // Allow the circle timer to overflow
    timerContainer.style.marginBottom = '15px';
    timerContainer.style.boxShadow = '0 3px 10px rgba(0,0,0,0.3)';
  }
  
  // Style the timer bar for better visibility
  const timerBar = document.getElementById('timer-bar');
  if (timerBar) {
    timerBar.style.height = '10px';
    timerBar.style.borderRadius = '5px';
    timerBar.style.transition = 'width 0.9s linear, background-color 0.3s ease, box-shadow 0.3s ease';
    timerBar.style.boxShadow = '0 0 8px rgba(245, 248, 52, 0.5)';
  }
  
  // Style the timer text for better visibility
  const timerText = document.getElementById('timer-text');
  if (timerText) {
    timerText.style.position = 'absolute';
    timerText.style.top = '-8px'; // Position it closer to the timer bar
    timerText.style.right = '10px';
    timerText.style.fontWeight = 'bold';
    timerText.style.fontSize = '20px';
    timerText.style.color = 'var(--primary-color, #F5F834)';
    timerText.style.textShadow = '0 0 5px rgba(0,0,0,0.8)';
    timerText.style.zIndex = '31'; // Above timer container
    timerText.style.padding = '3px 8px';
    timerText.style.background = 'rgba(0,0,0,0.6)';
    timerText.style.borderRadius = '5px';
    timerText.style.transition = 'color 0.3s ease, transform 0.15s ease';
  }
  
  // Ensure quote is properly visible without category header
  const quoteContainer = document.getElementById('quote-container');
  if (quoteContainer) {
    quoteContainer.style.width = '100%';
    quoteContainer.style.boxSizing = 'border-box';
    quoteContainer.style.padding = '12px';
    quoteContainer.style.backgroundColor = 'rgba(0,0,0,0.5)';
    quoteContainer.style.borderRadius = '8px';
    quoteContainer.style.marginBottom = '10px';
    quoteContainer.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
    quoteContainer.style.textAlign = 'center';
    
    // Make the "Who said this?" text more visible
    const quoteHeading = quoteContainer.querySelector('h2');
    if (quoteHeading) {
      quoteHeading.style.margin = '0 0 8px 0';
      quoteHeading.style.color = 'var(--primary-color, #F5F834)';
      quoteHeading.style.opacity = '0.9';
      quoteHeading.style.fontSize = '16px';
      quoteHeading.style.textShadow = '0 0 2px rgba(0,0,0,0.8)';
    }
    
    // Ensure the quote text itself is highlighted
    const quoteText = quoteContainer.querySelector('#quote-text');
    if (quoteText) {
      quoteText.style.fontWeight = 'bold';
      quoteText.style.fontSize = '16px';
      quoteText.style.lineHeight = '1.4';
      quoteText.style.margin = '0';
      quoteText.style.fontStyle = 'italic';
      quoteText.style.color = 'white';
      quoteText.style.letterSpacing = '0.02em';
      quoteText.style.textShadow = '0 0 2px rgba(0,0,0,0.8)';
      quoteText.style.maxHeight = '120px';
      quoteText.style.overflowY = 'auto';
    }
  }
  
  // Hide category display with important flag to ensure it's hidden
  const categoryDisplay = document.getElementById('category-display');
  if (categoryDisplay) {
    categoryDisplay.style.cssText = 'display: none !important; height: 0 !important; overflow: hidden !important;';
    window.logDiagnostic("Forcefully hidden category display");
  }
  
  // Ensure celebrities container has the proper layout
  const celebritiesContainer = document.getElementById('celebrities-container');
  if (celebritiesContainer) {
    celebritiesContainer.style.display = 'grid';
    celebritiesContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
    celebritiesContainer.style.gap = '10px';
    celebritiesContainer.style.width = '100%';
    celebritiesContainer.style.boxSizing = 'border-box';
    celebritiesContainer.style.paddingBottom = '20px'; // Add padding at bottom for scrolling space
    celebritiesContainer.style.maxHeight = 'calc(100vh - 170px)'; // Limit height to ensure it fits
    celebritiesContainer.style.overflowY = 'auto'; // Allow scrolling if needed
  }
  
  window.logDiagnostic("Completed ensureGameElementsVisible adjustments");
}

// Initialize the gameplay screen with optimized layout
function initializeGameplayScreen() {
  // Get the gameplay screen
  const gamePlayScreen = document.getElementById('game-play');
  if (!gamePlayScreen) {
    window.logDiagnostic("ERROR: Could not find game-play screen for initialization");
    return;
  }
  
  // Style the game play screen first
  gamePlayScreen.style.display = 'flex';
  gamePlayScreen.style.flexDirection = 'column';
  gamePlayScreen.style.alignItems = 'center';
  gamePlayScreen.style.justifyContent = 'flex-start';
  gamePlayScreen.style.padding = '10px';
  gamePlayScreen.style.width = '100%';
  gamePlayScreen.style.boxSizing = 'border-box';
  gamePlayScreen.style.maxHeight = '100vh';
  gamePlayScreen.style.height = 'auto';
  gamePlayScreen.style.overflowY = 'auto';
  gamePlayScreen.style.position = 'relative';
  gamePlayScreen.style.backgroundColor = 'rgba(0,0,0,0.7)';
  
  // Hide category display with important flag
  const categoryDisplay = document.getElementById('category-display');
  if (categoryDisplay) {
    categoryDisplay.style.cssText = 'display: none !important; height: 0 !important; overflow: hidden !important;';
    window.logDiagnostic("Hidden category display during initialization");
  }
  
  // Make sure timer container is at the top
  const timerContainer = document.getElementById('timer-container');
  if (timerContainer && gamePlayScreen.contains(timerContainer)) {
    // Move to the top of the game play screen
    gamePlayScreen.insertBefore(timerContainer, gamePlayScreen.firstChild);
    
    // Style the timer
    timerContainer.style.position = 'sticky';
    timerContainer.style.top = '0';
    timerContainer.style.zIndex = '100';
    timerContainer.style.width = '100%';
    timerContainer.style.height = '10px';
    timerContainer.style.margin = '0 0 15px 0';
    timerContainer.style.backgroundColor = 'rgba(0,0,0,0.5)';
    timerContainer.style.borderRadius = '5px';
    timerContainer.style.overflow = 'visible';
    timerContainer.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
    
    // Style the timer bar
    const timerBar = timerContainer.querySelector('#timer-bar');
    if (timerBar) {
      timerBar.style.height = '10px';
      timerBar.style.borderRadius = '5px';
      timerBar.style.backgroundColor = 'var(--primary-color, #F5F834)';
      timerBar.style.transition = 'width 0.9s linear, background-color 0.3s ease';
      timerBar.style.boxShadow = '0 0 8px rgba(245, 248, 52, 0.5)';
    }
    
    // Style the timer text
    const timerText = timerContainer.querySelector('#timer-text');
    if (timerText) {
      timerText.style.position = 'absolute';
      timerText.style.top = '-8px';
      timerText.style.right = '10px';
      timerText.style.fontWeight = 'bold';
      timerText.style.fontSize = '20px';
      timerText.style.color = 'var(--primary-color, #F5F834)';
      timerText.style.textShadow = '0 0 5px rgba(0,0,0,0.8)';
      timerText.style.padding = '3px 8px';
      timerText.style.background = 'rgba(0,0,0,0.6)';
      timerText.style.borderRadius = '5px';
      timerText.style.zIndex = '101';
    }
    
    window.logDiagnostic("Configured timer for optimal visibility");
  }
  
  // Style the quote container
  const quoteContainer = document.getElementById('quote-container');
  if (quoteContainer) {
    quoteContainer.style.width = '100%';
    quoteContainer.style.boxSizing = 'border-box';
    quoteContainer.style.padding = '12px';
    quoteContainer.style.backgroundColor = 'rgba(0,0,0,0.5)';
    quoteContainer.style.borderRadius = '8px';
    quoteContainer.style.marginBottom = '10px';
    quoteContainer.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
    quoteContainer.style.textAlign = 'center';
    
    // Style the heading
    const heading = quoteContainer.querySelector('h2');
    if (heading) {
      heading.style.margin = '0 0 8px 0';
      heading.style.color = 'var(--primary-color, #F5F834)';
      heading.style.fontSize = '16px';
    }
    
    // Style the quote text
    const quoteText = quoteContainer.querySelector('#quote-text');
    if (quoteText) {
      quoteText.style.fontWeight = 'bold';
      quoteText.style.fontSize = '16px';
      quoteText.style.lineHeight = '1.4';
      quoteText.style.fontStyle = 'italic';
      quoteText.style.color = 'white';
    }
  }
  
  // Style the celebrities container
  const celebritiesContainer = document.getElementById('celebrities-container');
  if (celebritiesContainer) {
    celebritiesContainer.style.display = 'grid';
    celebritiesContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
    celebritiesContainer.style.gap = '10px';
    celebritiesContainer.style.width = '100%';
    celebritiesContainer.style.boxSizing = 'border-box';
    celebritiesContainer.style.paddingBottom = '20px';
    celebritiesContainer.style.maxHeight = 'calc(100vh - 170px)';
    celebritiesContainer.style.overflowY = 'auto';
  }
  
  // Apply all optimizations
  optimizeGamePlayLayout();
  ensureGameElementsVisible();
  window.logDiagnostic("Applied full optimization to game-play screen during initialization");
}

// Function to verify all critical game elements exist
function verifyGameElements() {
  window.logDiagnostic("Verifying critical game elements...");
  
  const criticalElements = [
    { id: 'game-play', name: 'Game Play Screen' },
    { id: 'celebrities-container', name: 'Celebrities Container' },
    { id: 'quote-text', name: 'Quote Text' },
    { id: 'timer-bar', name: 'Timer Bar' },
    { id: 'timer-text', name: 'Timer Text' },
    { id: 'timer-container', name: 'Timer Container' }
  ];
  
  let missingElements = [];
  
  // Check for each critical element
  criticalElements.forEach(element => {
    const el = document.getElementById(element.id);
    if (!el) {
      window.logDiagnostic(`MISSING: ${element.name} (${element.id})`);
      missingElements.push(element);
    } else {
      window.logDiagnostic(`FOUND: ${element.name} (${element.id})`);
    }
  });
  
  // If any elements are missing, attempt to create them
  if (missingElements.length > 0) {
    window.logDiagnostic(`Missing ${missingElements.length} critical elements - attempting repair`);
    
    // Try to find game-play screen first as it's the container
    let gamePlayScreen = document.getElementById('game-play');
    
    // If game-play screen doesn't exist, we need to create it
    if (!gamePlayScreen) {
      window.logDiagnostic("Creating missing game-play screen");
      
      gamePlayScreen = document.createElement('div');
      gamePlayScreen.id = 'game-play';
      gamePlayScreen.className = 'game-screen';
      gamePlayScreen.style.display = 'none';
      gamePlayScreen.style.flexDirection = 'column';
      gamePlayScreen.style.alignItems = 'center';
      gamePlayScreen.style.justifyContent = 'flex-start';
      gamePlayScreen.style.padding = '10px';
      gamePlayScreen.style.width = '100%';
      gamePlayScreen.style.height = '100%';
      gamePlayScreen.style.boxSizing = 'border-box';
      gamePlayScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      
      // Add to the game container
      const gameContainer = document.getElementById('game-container');
      if (gameContainer) {
        gameContainer.appendChild(gamePlayScreen);
        window.logDiagnostic("Added game-play screen to game container");
      } else {
        // If no game container, add to body
        document.body.appendChild(gamePlayScreen);
        window.logDiagnostic("Added game-play screen to body (no game container found)");
      }
    }
    
    // Check for timer container
    if (!document.getElementById('timer-container')) {
      window.logDiagnostic("Creating missing timer container");
      
      const timerContainer = document.createElement('div');
      timerContainer.id = 'timer-container';
      timerContainer.style.width = '100%';
      timerContainer.style.height = '10px';
      timerContainer.style.position = 'relative';
      timerContainer.style.marginBottom = '15px';
      timerContainer.style.marginTop = '25px';
      timerContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
      timerContainer.style.borderRadius = '5px';
      timerContainer.style.overflow = 'visible';
      
      // Create timer bar if missing
      if (!document.getElementById('timer-bar')) {
        const timerBar = document.createElement('div');
        timerBar.id = 'timer-bar';
        timerBar.style.width = '100%';
        timerBar.style.height = '100%';
        timerBar.style.backgroundColor = '#F5F834';
        timerBar.style.borderRadius = '5px';
        timerBar.style.transition = 'width 0.9s linear';
        timerContainer.appendChild(timerBar);
        window.logDiagnostic("Added timer-bar to timer container");
      }
      
      // Create timer text if missing
      if (!document.getElementById('timer-text')) {
        const timerText = document.createElement('div');
        timerText.id = 'timer-text';
        timerText.textContent = gameState.timerDuration.toString();
        timerText.style.position = 'absolute';
        timerText.style.top = '-25px';
        timerText.style.right = '10px';
        timerText.style.color = '#F5F834';
        timerText.style.fontWeight = 'bold';
        timerText.style.fontSize = '20px';
        timerText.style.padding = '3px 8px';
        timerText.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        timerText.style.borderRadius = '5px';
        timerText.style.zIndex = '101';
        timerContainer.appendChild(timerText);
        window.logDiagnostic("Added timer-text to timer container");
      }
      
      // Add timer container to game play screen
      gamePlayScreen.insertBefore(timerContainer, gamePlayScreen.firstChild);
    }
    
    // Check for quote container and text
    if (!document.getElementById('quote-container')) {
      window.logDiagnostic("Creating missing quote container");
      
      const quoteContainer = document.createElement('div');
      quoteContainer.id = 'quote-container';
      quoteContainer.style.width = '100%';
      quoteContainer.style.marginBottom = '15px';
      quoteContainer.style.padding = '15px';
      quoteContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      quoteContainer.style.borderRadius = '8px';
      quoteContainer.style.textAlign = 'center';
      
      // Add heading
      const heading = document.createElement('h2');
      heading.textContent = 'Who said this?';
      heading.style.margin = '0 0 10px 0';
      heading.style.color = '#F5F834';
      heading.style.fontSize = '16px';
      quoteContainer.appendChild(heading);
      
      // Create quote text if missing
      if (!document.getElementById('quote-text')) {
        const quoteText = document.createElement('div');
        quoteText.id = 'quote-text';
        quoteText.textContent = '"Loading quote..."';
        quoteText.style.fontWeight = 'bold';
        quoteText.style.fontSize = '16px';
        quoteText.style.lineHeight = '1.4';
        quoteText.style.color = 'white';
        quoteText.style.fontStyle = 'italic';
        quoteContainer.appendChild(quoteText);
        window.logDiagnostic("Added quote-text to quote container");
      }
      
      // Add quote container to game play screen after timer
      const timerContainer = document.getElementById('timer-container');
      if (timerContainer) {
        gamePlayScreen.insertBefore(quoteContainer, timerContainer.nextSibling);
      } else {
        gamePlayScreen.appendChild(quoteContainer);
      }
    }
    
    // Check for celebrities container
    if (!document.getElementById('celebrities-container')) {
      window.logDiagnostic("Creating missing celebrities container");
      
      const celebritiesContainer = document.createElement('div');
      celebritiesContainer.id = 'celebrities-container';
      celebritiesContainer.style.display = 'grid';
      celebritiesContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
      celebritiesContainer.style.gap = '0.6rem';
      celebritiesContainer.style.width = '100%';
      celebritiesContainer.style.marginTop = '8px';
      
      // Add celebrities container to game play screen
      gamePlayScreen.appendChild(celebritiesContainer);
      window.logDiagnostic("Added celebrities-container to game play screen");
    }
    
    // Check for current category element (even though it's hidden)
    if (!document.getElementById('current-category')) {
      window.logDiagnostic("Creating missing current-category display");
      
      const categoryDisplay = document.createElement('div');
      categoryDisplay.id = 'category-display';
      categoryDisplay.style.display = 'none';
      
      const currentCategory = document.createElement('div');
      currentCategory.id = 'current-category';
      currentCategory.textContent = 'Music';
      categoryDisplay.appendChild(currentCategory);
      
      // Add category display to game play screen
      gamePlayScreen.appendChild(categoryDisplay);
      window.logDiagnostic("Added current-category to game play screen");
    }
    
    // Refresh DOM references
    refreshDOMReferences();
    
    // Check again to see if repair was successful
    let stillMissing = 0;
    missingElements.forEach(element => {
      if (!document.getElementById(element.id)) {
        window.logDiagnostic(`STILL MISSING after repair: ${element.name} (${element.id})`);
        stillMissing++;
      } else {
        window.logDiagnostic(`REPAIRED: ${element.name} (${element.id})`);
      }
    });
    
    if (stillMissing > 0) {
      window.logDiagnostic(`REPAIR INCOMPLETE: ${stillMissing} elements still missing`);
      return false;
    } else {
      window.logDiagnostic(`REPAIR SUCCESSFUL: All critical elements now present`);
      return true;
    }
  } else {
    window.logDiagnostic("All critical game elements are present");
    return true;
  }
}

// Enable audio on user interaction
function enableGameAudio() {
  // Try to create and resume audio context
  try {
    console.log('Enabling game audio...');
    
    if (!audioContext) {
      try {
        // Try up to 3 times to create an audio context
        let attempts = 0;
        while (!audioContext && attempts < 3) {
          try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('Created new AudioContext:', audioContext.state);
            window.logDiagnostic(`Created audio context in enableGameAudio, state: ${audioContext.state}`);
            break; // Success, exit the retry loop
          } catch (err) {
            attempts++;
            console.error(`Failed to create AudioContext (attempt ${attempts}/3):`, err);
            window.logDiagnostic(`Failed to create AudioContext (attempt ${attempts}/3): ${err.message}`);
            
            // Small delay before retry
            if (attempts < 3) {
              const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
              delay(100).then(() => console.log('Retrying audio context creation...'));
            }
          }
        }
        
        if (!audioContext) {
          console.error('All attempts to create AudioContext failed');
          window.logDiagnostic('All attempts to create AudioContext failed');
          return false;
        }
      } catch (err) {
        console.error('Failed to create AudioContext:', err);
        window.logDiagnostic(`Failed to create AudioContext: ${err.message}`);
        return false;
      }
    } else {
      console.log('Using existing AudioContext:', audioContext.state);
    }
    
    // Force resume the audio context with retry logic
    if (audioContext && audioContext.state === 'suspended') {
      console.log('Resuming suspended AudioContext...');
      
      // Use a self-executing async function for retries with delays
      (async function resumeWithRetry() {
        let resumeAttempts = 0;
        while (audioContext.state === 'suspended' && resumeAttempts < 3) {
          try {
            await audioContext.resume();
            console.log('AudioContext resumed successfully');
            window.logDiagnostic(`Audio context resumed successfully after ${resumeAttempts + 1} attempts`);
            break; // Success
          } catch (err) {
            resumeAttempts++;
            console.error(`Resume attempt ${resumeAttempts}/3 failed:`, err);
            window.logDiagnostic(`Resume attempt ${resumeAttempts}/3 failed: ${err.message}`);
            
            // Wait before next attempt
            if (resumeAttempts < 3) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
        }
        
        // Play a test sound after successful resume or give up
        playTestSound();
      })();
    } else if (audioContext) {
      console.log('AudioContext already running, state:', audioContext.state);
      // Play a test sound immediately
      playTestSound();
    }
    
    // Play a silent sound to unlock audio on iOS
    try {
      const silentBuffer = audioContext.createBuffer(1, 1, 22050);
      const silentSource = audioContext.createBufferSource();
      silentSource.buffer = silentBuffer;
      silentSource.connect(audioContext.destination);
      silentSource.start();
      console.log('Silent audio played for iOS unlock');
    } catch (err) {
      console.error('Error playing silent audio:', err);
    }
    
    // Initialize sound effects if not already done
    createCorrectSound();
    createIncorrectSound();
    
    // Initialize the countdown ticker
    if (!countdownTicker) {
      console.log('Creating new countdown ticker in enableGameAudio');
      countdownTicker = createCountdownTicking();
      window.logDiagnostic("Countdown ticker initialized in enableGameAudio");
    } else {
      console.log('Using existing countdown ticker');
    }
    
    // Test the tick sound immediately
    function playTestSound() {
      try {
        if (countdownTicker && countdownTicker.tick) {
          console.log('Playing test tick sound...');
          setTimeout(() => {
            countdownTicker.tick();
            console.log('Test tick played');
            window.logDiagnostic("Test tick sound played successfully");
          }, 300);
        } else {
          console.log('No countdown ticker available, creating one for test sound');
          // Create a ticker just for testing
          countdownTicker = createCountdownTicking();
          if (countdownTicker) {
            setTimeout(() => {
              countdownTicker.tick();
              window.logDiagnostic("Created countdown ticker and played test tick");
            }, 300);
          } else {
            window.logDiagnostic("Failed to create countdown ticker for test");
          }
        }
      } catch (err) {
        console.error('Error playing test sound:', err);
        window.logDiagnostic(`Error playing test sound: ${err.message}`);
      }
    }
    
    window.logDiagnostic("Game audio enabled successfully");
    return true;
  } catch (err) {
    console.error("Error enabling game audio:", err);
    window.logDiagnostic(`Error enabling game audio: ${err.message}`);
    return false;
  }
}
