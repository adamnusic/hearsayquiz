import './createPost.js';

import { Devvit, useState, useWebView, useEffect } from '@devvit/public-api';

import type { DevvitMessage, WebViewMessage, QuoteData } from './message.js';

Devvit.configure({
  redditAPI: true,
  redis: true,
  media: true
});

// Categories for the game
const CATEGORIES = ['Music', 'Politics', 'Movies', 'History', 'Sports', 'Academia'];

// Mock quote data for demonstration
const MOCK_QUOTES: Record<string, QuoteData[]> = {
  Music: [
    {
      id: 'music1',
      quote: "A lot of people don't appreciate the moment until it's passed.",
      correctCelebrity: "Ye",
      celebrities: ["Drake", "John Lennon", "Psy", "Rick Rubin", "Snoop Dogg", "Ye"],
      audioClips: {
        "Drake": "audio/music/drake_music.wav",
        "John Lennon": "audio/music/john-lennon_music.wav",
        "Psy": "audio/music/psy_music.wav",
        "Rick Rubin": "audio/music/rick-rubin_music.wav",
        "Snoop Dogg": "audio/music/snoop-dogg_music.wav",
        "Ye": "audio/music/ye_music.wav"
      }
    }
  ],
  Movies: [
    {
      id: 'movies1',
      quote: "May the Force be with you.",
      correctCelebrity: "Harrison Ford",
      celebrities: ["Harrison Ford", "Mark Hamill", "Carrie Fisher", "James Earl Jones", "Samuel L. Jackson", "Daisy Ridley"],
      audioClips: {
        "Harrison Ford": "audio/movies/ford_force.mp3",
        "Mark Hamill": "audio/movies/hamill_force.mp3",
        "Carrie Fisher": "audio/movies/fisher_force.mp3",
        "James Earl Jones": "audio/movies/jones_force.mp3",
        "Samuel L. Jackson": "audio/movies/jackson_force.mp3",
        "Daisy Ridley": "audio/movies/ridley_force.mp3"
      }
    }
  ],
  Politics: [
    {
      id: 'politics1',
      quote: "Ask not what your country can do for you, ask what you can do for your country.",
      correctCelebrity: "John F. Kennedy",
      celebrities: ["John F. Kennedy", "Barack Obama", "Winston Churchill", "Ronald Reagan", "Margaret Thatcher", "Abraham Lincoln"],
      audioClips: {
        "John F. Kennedy": "audio/politics/kennedy_ask.mp3",
        "Barack Obama": "audio/politics/obama_ask.mp3",
        "Winston Churchill": "audio/politics/churchill_ask.mp3",
        "Ronald Reagan": "audio/politics/reagan_ask.mp3",
        "Margaret Thatcher": "audio/politics/thatcher_ask.mp3",
        "Abraham Lincoln": "audio/politics/lincoln_ask.mp3"
      }
    }
  ],
  History: [
    {
      id: 'history1',
      quote: "I have a dream.",
      correctCelebrity: "Martin Luther King Jr.",
      celebrities: ["Martin Luther King Jr.", "Malcolm X", "Rosa Parks", "Nelson Mandela", "Gandhi", "Frederick Douglass"],
      audioClips: {
        "Martin Luther King Jr.": "audio/history/king_dream.mp3",
        "Malcolm X": "audio/history/malcolm_dream.mp3",
        "Rosa Parks": "audio/history/parks_dream.mp3",
        "Nelson Mandela": "audio/history/mandela_dream.mp3",
        "Gandhi": "audio/history/gandhi_dream.mp3",
        "Frederick Douglass": "audio/history/douglass_dream.mp3"
      }
    }
  ],
  Sports: [
    {
      id: 'sports1',
      quote: "Float like a butterfly, sting like a bee.",
      correctCelebrity: "Muhammad Ali",
      celebrities: ["Muhammad Ali", "Michael Jordan", "Serena Williams", "Usain Bolt", "Tiger Woods", "Simone Biles"],
      audioClips: {
        "Muhammad Ali": "audio/sports/ali_float.mp3",
        "Michael Jordan": "audio/sports/jordan_float.mp3",
        "Serena Williams": "audio/sports/williams_float.mp3",
        "Usain Bolt": "audio/sports/bolt_float.mp3",
        "Tiger Woods": "audio/sports/woods_float.mp3",
        "Simone Biles": "audio/sports/biles_float.mp3"
      }
    }
  ],
  Academia: [
    {
      id: 'academia1',
      quote: "Imagination is more important than knowledge.",
      correctCelebrity: "Albert Einstein",
      celebrities: ["Albert Einstein", "Stephen Hawking", "Marie Curie", "Neil deGrasse Tyson", "Jane Goodall", "Carl Sagan"],
      audioClips: {
        "Albert Einstein": "audio/academia/einstein_imagination.mp3",
        "Stephen Hawking": "audio/academia/hawking_imagination.mp3",
        "Marie Curie": "audio/academia/curie_imagination.mp3",
        "Neil deGrasse Tyson": "audio/academia/tyson_imagination.mp3",
        "Jane Goodall": "audio/academia/goodall_imagination.mp3",
        "Carl Sagan": "audio/academia/sagan_imagination.mp3"
      }
    }
  ]
};

// Add a custom post type to Devvit
Devvit.addCustomPostType({
  name: 'Hear Say!? Game',
  height: 'tall',
  render: (context) => {
    // Load username and score with useState
    const [username, setUsername] = useState<string>('Loading...');
    const [score, setScore] = useState<number>(0);

    // Load initial data when webview is ready
    const loadInitialData = async () => {
      try {
        // Get username
        const currentUsername = await context.reddit.getCurrentUsername() ?? 'anon';
        setUsername(currentUsername);
        console.log('Loaded username:', currentUsername);

        // Get score from Redis
        const redisScore = await context.redis.get(`hearsay_score_${currentUsername}`);
        console.log('Loaded score from Redis:', redisScore);
        setScore(Number(redisScore ?? 0));
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };

    // Track the selected category
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Helper function to get asset URL for audio files
    const getAudioURL = (path: string) => {
      return context.assets.getURL(path);
    };

    // Create game data with properly formatted audio URLs
    const getGameData = (category: string) => {
      const categoryQuotes = MOCK_QUOTES[category];
      const randomQuote = {...categoryQuotes[Math.floor(Math.random() * categoryQuotes.length)]};
      
      // Convert audio clip paths to asset URLs
      const audioClips: Record<string, string> = {};
      for (const [celeb, path] of Object.entries(randomQuote.audioClips)) {
        audioClips[celeb] = getAudioURL(path);
      }
      
      // Replace the audio clips with the proper URLs
      randomQuote.audioClips = audioClips;
      
      return {
        category,
        quoteData: randomQuote
      };
    };

    const webView = useWebView<WebViewMessage, DevvitMessage>({
      // URL of your web view content
      url: 'page.html',

      // Handle messages sent from the web view
      async onMessage(message, webView) {
        console.log('Received message from webview:', message);
        
        switch (message.type) {
          case 'webViewReady':
            console.log('Web view is ready, loading initial data');
            await loadInitialData();
            
            webView.postMessage({
              type: 'initialData',
              data: {
                username: username,
                currentCounter: score,
              },
            });
            
            if (selectedCategory) {
              console.log('Selected category exists, sending game data for:', selectedCategory);
              // If category is already selected, send game data immediately
              const gameData = getGameData(selectedCategory);
              
              webView.postMessage({
                type: 'gameData',
                data: gameData,
              });
            }
            break;
          case 'categorySelected':
            // This is now handled directly in the main view, but kept for backward compatibility
            setSelectedCategory(message.data.category);
            // Get game data with proper asset URLs
            const gameData = getGameData(message.data.category);
            
            webView.postMessage({
              type: 'gameData',
              data: gameData,
            });
            break;
          case 'quoteAnswered':
            if (message.data.correct) {
              // If correct, update the score
              const newScore = score + message.data.score;
              console.log('Updating score in Redis:', {
                username,
                oldScore: score,
                newScore,
                key: `hearsay_score_${username}`
              });
              await context.redis.set(`hearsay_score_${username}`, newScore.toString());
              setScore(newScore);
            }
            break;
          case 'playAgain':
            // User wants to play again, set selected category to null
            // The webview will automatically close when user clicks outside of it
            setSelectedCategory(null);
            break;
          default:
            // Handle other message types
            if ((message as any).type === 'setCounter') {
              const newCounter = (message as any).data.newCounter;
              await context.redis.set(`hearsay_score_${username}`, newCounter.toString());
              setScore(newCounter);
            }
        }
      },
      onUnmount() {
        context.ui.showToast('Hear Say!? game closed!');
      },
    });

    // Update the category button press handler
    const handleCategoryPress = (category: string) => {
      console.log('Category button pressed:', category);
      
      setSelectedCategory(category);
      
      // Mount the webview first
      console.log('Mounting webview');
      webView.mount();
      
      // Get game data with proper asset URLs
      console.log('Preparing game data for category:', category);
      const gameData = getGameData(category);
      console.log('Game data prepared, quoteId:', gameData.quoteData.id);
      
      // Give it a moment to mount, then send the data
      console.log('Setting timeout to send game data');
      setTimeout(() => {
        console.log('Timeout fired, sending gameData for category:', category);
        webView.postMessage({
          type: 'gameData',
          data: gameData,
        });
        console.log('gameData message sent');
      }, 1000); // Increased timeout to ensure webview is fully mounted
    };

    // Display the UI
    return (
      <vstack grow padding="small">
        <vstack 
          grow 
          alignment="middle center" 
          padding="large"
          cornerRadius="medium"
          minWidth="400px"
          minHeight="500px"
        >
          <icon 
            name="topic-celebrity"
            size="large"
            color="#F5F834"
          />
          
          <spacer size="medium" />
          
          <text size="xlarge" weight="bold" color="white">
            Hear Say!?
          </text>
          
          <hstack gap="small">
            <text size="xlarge" color="white">Player: </text>
            <text size="xlarge" weight="bold" color="#F5F834">
              {username ?? ''}
            </text>
            <text size="xlarge" color="white"> | Score: </text>
            <text size="xlarge" weight="bold" color="#F5F834">
              {score ?? '0'}
            </text>
          </hstack>
          
          <spacer size="medium" />
          
          <text size="xlarge" color="white" alignment="middle">
            Test your knowledge of not-so-famous quotes from famous people!
          </text>
          
          <spacer size="medium" />
          
          <vstack gap="medium" alignment="middle center">
            <hstack gap="medium" alignment="middle center">
              {CATEGORIES.slice(0, 3).map((category) => (
                <button
                  key={category}
                  onPress={() => handleCategoryPress(category)}
                >
                  {getCategoryEmoji(category)} {category}
                </button>
              ))}
            </hstack>
            <hstack gap="medium" alignment="middle center">
              {CATEGORIES.slice(3, 6).map((category) => (
                <button
                  key={category}
                  onPress={() => handleCategoryPress(category)}
                >
                  {getCategoryEmoji(category)} {category}
                </button>
              ))}
            </hstack>
          </vstack>
        </vstack>
      </vstack>
    );
  },
});

// Helper function to get category emojis
function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    'Music': '🎵',
    'Politics': '🏛️',
    'Movies': '🎬',
    'History': '📜',
    'Sports': '⚽',
    'Academia': '🎓'
  };
  
  return emojiMap[category] || '';
}

// Export the Devvit app
export default Devvit;
