import './createPost.js';

import { Devvit, useState, useWebView } from '@devvit/public-api';

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
    const [isLoading, setIsLoading] = useState<boolean>(true);

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

    // Load username with proper error handling and caching
    const loadUsername = async () => {
      try {
        console.log('Attempting to get username with caching...');
        const username = await context.cache(
          async () => {
            const result = await context.reddit.getCurrentUsername();
            console.log('Raw username from reddit.getCurrentUsername:', result);
            return result ?? 'anon';
          },
          {
            key: 'current_username',
            ttl: 60 * 60 * 1000, // 1 hour cache
          }
        );
        console.log('Cached username result:', username);
        return username;
      } catch (error) {
        console.log('Error getting username, using fallback:', error);
        return 'anon';
      }
    };

    // Load score from Redis with proper error handling
    const loadScore = async (username: string) => {
      try {
        console.log('Fetching score for username:', username);
        const redisKey = `hearsay:score:${username}`;
        const redisScore = await context.redis.get(redisKey);
        console.log('Redis score result:', redisScore);
        return redisScore ? parseInt(redisScore, 10) : 0;
      } catch (error) {
        console.log('Error accessing Redis, using default score:', error);
        return 0;
      }
    };

    // Initialize game state with proper sequencing
    const initializeGameState = async () => {
      try {
        console.log('Starting game state initialization...');
        
        // First, get the username
        const currentUsername = await loadUsername();
        console.log('Setting username to:', currentUsername);
        setUsername(currentUsername);
        
        // Then, get the score
        const currentScore = await loadScore(currentUsername);
        console.log('Setting score to:', currentScore);
        setScore(currentScore);
        
        // Finally, update loading state
        setIsLoading(false);
        
        return {
          username: currentUsername,
          score: currentScore
        };
      } catch (error) {
        console.error('Error initializing game state:', error);
        setUsername('anon');
        setScore(0);
        setIsLoading(false);
        return {
          username: 'anon',
          score: 0
        };
      }
    };

    const webView = useWebView<WebViewMessage, DevvitMessage>({
      url: 'page.html',

      async onMessage(message, webView) {
        console.log('Received message from webview:', message);
        
        switch (message.type) {
          case 'webViewReady':
            console.log('Web view is ready, initializing game state');
            const gameState = await initializeGameState();
            
            // Send initial data to webview immediately
            console.log('Sending initial data to webview:', gameState);
            webView.postMessage({
              type: 'initialData',
              data: {
                username: gameState.username,
                currentCounter: gameState.score,
              },
            });
            break;
            
          case 'readyForGameData':
            console.log('Webview ready for game data, sending current state');
            // Send current state immediately
            webView.postMessage({
              type: 'initialData',
              data: {
                username,
                currentCounter: score,
              },
            });
            // If we have a selected category, send game data
            if (selectedCategory) {
              const gameData = getGameData(selectedCategory);
              webView.postMessage({
                type: 'gameData',
                data: gameData,
              });
            }
            break;
            
          case 'categorySelected':
            setSelectedCategory(message.data.category);
            const gameData = getGameData(message.data.category);
            // Send current state with game data
            webView.postMessage({
              type: 'initialData',
              data: {
                username,
                currentCounter: score,
              },
            });
            webView.postMessage({
              type: 'gameData',
              data: gameData,
            });
            break;
            
          case 'quoteAnswered':
            if (message.data.correct) {
              console.log('Correct answer, updating score:', message.data.score);
              await handleScore(score + message.data.score);
            }
            break;
            
          case 'playAgain':
            setSelectedCategory(null);
            // Send current state when playing again
            webView.postMessage({
              type: 'initialData',
              data: {
                username,
                currentCounter: score,
              },
            });
            break;
            
          default:
            if ((message as any).type === 'setCounter') {
              await handleScore((message as any).data.newCounter);
            }
        }
      },
      onUnmount() {
        context.ui.showToast('Hear Say!? game closed!');
      },
    });

    // Single function to handle all score operations
    const handleScore = async (newScore: number) => {
      try {
        console.log('Updating score:', {
          username,
          oldScore: score,
          newScore,
        });
        
        try {
          // Update Redis using regular key
          const redisKey = `hearsay:score:${username}`;
          await context.redis.set(redisKey, newScore.toString());
          console.log('Score updated in Redis:', redisKey, newScore);
        } catch (error) {
          console.log('Error updating Redis, continuing with local state:', error);
        }
        
        // Update local state regardless of Redis success
        setScore(newScore);
        
        // Send updated score to webview
        webView.postMessage({
          type: 'initialData',
          data: {
            username,
            currentCounter: newScore,
          },
        });
      } catch (error) {
        console.error('Error updating score:', error);
        // Still update local state even if Redis fails
        setScore(newScore);
      }
    };

    // Update the category button press handler
    const handleCategoryPress = async (category: string) => {
      console.log('Category button pressed:', category);
      setSelectedCategory(category);
      webView.mount();
      
      // Ensure we have the latest game state
      const gameState = await initializeGameState();
      
      const gameData = getGameData(category);
      console.log('Game data prepared, quoteId:', gameData.quoteData.id);
      
      // Send game data and initial data to webview
      webView.postMessage({
        type: 'initialData',
        data: {
          username: gameState.username,
          currentCounter: gameState.score,
        },
      });
      webView.postMessage({
        type: 'gameData',
        data: gameData,
      });
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
              {isLoading ? 'Loading...' : username}
            </text>
            <text size="xlarge" color="white"> | Score: </text>
            <text size="xlarge" weight="bold" color="#F5F834">
              {isLoading ? '0' : score}
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
