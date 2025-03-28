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
const MOCK_QUOTES = [
  {
    id: 'movies',
    quote: "It does not do to dwell on dreams and forget to live.",
    correctCelebrity: "Harry Potter",
    celebrities: [
      "Alex DeLarge",
      "Darth Vader",
      "Don Corleone",
      "Harry Potter",
      "Jules Winnfield",
      "Robocop"
    ],
    audioClips: {
      "Alex DeLarge": "audio/movies/alex-delarge_movies.wav",
      "Darth Vader": "audio/movies/darth-vader_movies.wav",
      "Don Corleone": "audio/movies/don-corleone_movies.wav",
      "Harry Potter": "audio/movies/harry-potter_movies.wav",
      "Jules Winnfield": "audio/movies/jules-winnfield_movies.wav",
      "Robocop": "audio/movies/robocop_movies.wav"
    },
    images: {
      "Alex DeLarge": "images/movies/alex-delarge_movies.jpg",
      "Darth Vader": "images/movies/darth-vader_movies.jpg",
      "Don Corleone": "images/movies/don-corleone_movies.jpg",
      "Harry Potter": "images/movies/harry-potter_movies.jpg",
      "Jules Winnfield": "images/movies/jules-winnfield_movies.jpg",
      "Robocop": "images/movies/robocop_movies.jpg"
    }
  },
  {
    id: 'music',
    quote: "A lot of people don't appreciate the moment until it's passed.",
    correctCelebrity: "Ye",
    celebrities: [
      "Drake",
      "John Lennon",
      "Psy",
      "Rick Rubin",
      "Snoop Dogg",
      "Ye"
    ],
    audioClips: {
      "Drake": "audio/music/drake_music.wav",
      "John Lennon": "audio/music/john-lennon_music.wav",
      "Psy": "audio/music/psy_music.wav",
      "Rick Rubin": "audio/music/rick-rubin_music.wav",
      "Snoop Dogg": "audio/music/snoop-dogg_music.wav",
      "Ye": "audio/music/ye_music.wav"
    },
    images: {
      "Drake": "images/music/drake_music.jpg",
      "John Lennon": "images/music/john-lennon_music.jpg",
      "Psy": "images/music/psy_music.jpg",
      "Rick Rubin": "images/music/rick-rubin_music.jpg",
      "Snoop Dogg": "images/music/snoop-dogg_music.jpg",
      "Ye": "images/music/ye_music.jpg"
    }
  },
  {
    id: 'politics',
    quote: "A majority has no right to vote away the rights of a minority.",
    correctCelebrity: "Ayn Rand",
    celebrities: [
      "Ayn Rand",
      "Bernie Sanders",
      "Donald Trump",
      "George W Bush",
      "Richard Nixon",
      "Xi Jinping"
    ],
    audioClips: {
      "Ayn Rand": "audio/politics/ayn-rand_politics.wav",
      "Bernie Sanders": "audio/politics/bernie-sanders_politics.wav",
      "Donald Trump": "audio/politics/donald-trump_politics.wav",
      "George W Bush": "audio/politics/george-w-bush_politics.wav",
      "Richard Nixon": "audio/politics/richard-nixon_politics.wav",
      "Xi Jinping": "audio/politics/xi-jinping_politics.wav"
    },
    images: {
      "Ayn Rand": "images/politics/ayn-rand_politics.jpg",
      "Bernie Sanders": "images/politics/bernie-sanders_politics.jpg",
      "Donald Trump": "images/politics/donald-trump_politics.jpg",
      "George W Bush": "images/politics/george-w-bush_politics.jpg",
      "Richard Nixon": "images/politics/richard-nixon_politics.jpg",
      "Xi Jinping": "images/politics/xi-jinping_politics.jpg"
    }
  },
  {
    id: 'history',
    quote: "Do not compare yourself to others, if you do so you are insulting yourself.",
    correctCelebrity: "Adolf Hitler",
    celebrities: [
      "Adolf Hitler",
      "Jesus Christ",
      "Julius Ceasar",
      "Napoleon Bonaparte",
      "Neil Armstrong",
      "Sam Bankman Fried"
    ],
    audioClips: {
      "Adolf Hitler": "audio/history/adolf-hitler_history.wav",
      "Jesus Christ": "audio/history/jesus-christ_history.wav",
      "Julius Ceasar": "audio/history/julius-ceasar_history.wav",
      "Napoleon Bonaparte": "audio/history/napoleon-bonaparte_history.wav",
      "Neil Armstrong": "audio/history/neil-armstrong_history.wav",
      "Sam Bankman Fried": "audio/history/sam-bankman-fried_history.wav"
    },
    images: {
      "Adolf Hitler": "images/history/adolf-hitler_history.jpg",
      "Jesus Christ": "images/history/jesus-christ_history.jpg",
      "Julius Ceasar": "images/history/julius-ceasar_history.jpg",
      "Napoleon Bonaparte": "images/history/napoleon-bonaparte_history.jpg",
      "Neil Armstrong": "images/history/neil-armstrong_history.jpg",
      "Sam Bankman Fried": "images/history/sam-bankman-fried_history.jpg"
    }
  },
  {
    id: 'sports',
    quote: "I know what I need to do to win and I'm just really focussed on that.",
    correctCelebrity: "Usain Bolt",
    celebrities: [
      "Conor McGregor",
      "Cristiano Ronaldo",
      "David Beckham",
      "Messi",
      "Usain Bolt",
      "Yusuf Dikeç"
    ],
    audioClips: {
      "Conor McGregor": "audio/sports/conor-mcgregor_sports.wav",
      "Cristiano Ronaldo": "audio/sports/cristiano-ronaldo_sports.wav",
      "David Beckham": "audio/sports/david-beckham_sports.wav",
      "Messi": "audio/sports/messi_sports.wav",
      "Usain Bolt": "audio/sports/usain-bolt_sports.wav",
      "Yusuf Dikeç": "audio/sports/yusuf-dikec_sports.wav"
    },
    images: {
      "Conor McGregor": "images/sports/conor-mcgregor_sports.jpg",
      "Cristiano Ronaldo": "images/sports/cristiano-ronaldo_sports.jpg",
      "David Beckham": "images/sports/david-beckham_sports.jpg",
      "Messi": "images/sports/messi_sports.jpg",
      "Usain Bolt": "images/sports/usain-bolt_sports.jpg",
      "Yusuf Dikeç": "images/sports/yusuf-dikec_sports.jpg"
    }
  },
  {
    id: 'academia',
    quote: "A scientist in his laboratory is not only a technician, he is also a child.",
    correctCelebrity: "Marie Curie",
    celebrities: [
      "Albert Einstein",
      "Da Vinci",
      "He Jiankui",
      "Jensen Huang",
      "Marie Curie",
      "Oppenheimer"
    ],
    audioClips: {
      "Albert Einstein": "audio/academia/albert-einstein_academia.wav",
      "Da Vinci": "audio/academia/da-vinci_academia.wav",
      "He Jiankui": "audio/academia/he-jiankui_academia.wav",
      "Jensen Huang": "audio/academia/jensen-huang_academia.wav",
      "Marie Curie": "audio/academia/marie-curie_academia.wav",
      "Oppenheimer": "audio/academia/oppenheimer_academia.wav"
    },
    images: {
      "Albert Einstein": "images/academia/albert-einstein_academia.jpg",
      "Da Vinci": "images/academia/da-vinci_academia.jpg",
      "He Jiankui": "images/academia/he-jiankui_academia.jpg",
      "Jensen Huang": "images/academia/jensen-huang_academia.jpg",
      "Marie Curie": "images/academia/marie-curie_academia.jpg",
      "Oppenheimer": "images/academia/oppenheimer_academia.jpg"
    }
  }
];

type GameCategory = 'Music' | 'Politics' | 'Movies' | 'History' | 'Sports' | 'Academia';

interface GameData {
  quoteData: QuoteData;
}

interface GameResponse {
  category: string;
  quoteData: QuoteData;
}

function getGameData(category: string): GameResponse {
  // Find the quote data for the selected category
  const quoteData = MOCK_QUOTES.find(quote => {
    // Direct category match without any string manipulation
    return quote.id.toLowerCase() === category.toLowerCase();
  });
  
  if (!quoteData) {
    console.error(`Invalid category selected: ${category}`);
    throw new Error(`Invalid category: ${category}`);
  }

  console.log('Found quote data for category:', category, quoteData);
  return {
    category,
    quoteData: quoteData
  };
}

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
            console.log('Selected category:', selectedCategory);
            
            // If no category is selected, wait for one
            if (!selectedCategory) {
              console.log('No category selected yet, waiting for selection');
              return;
            }
            
            const gameData = getGameData(selectedCategory);
            console.log('Sending game data for category:', selectedCategory);
            console.log('Game data:', gameData);
            
            // Send game data first
            webView.postMessage({
              type: 'gameData',
              data: gameData,
            });
            
            // Then send current state
            webView.postMessage({
              type: 'initialData',
              data: {
                username,
                currentCounter: score,
              },
            });
            break;
            
          case 'categorySelected':
            console.log('Category selected:', message.data.category);
            setSelectedCategory(message.data.category);
            
            // Get and send game data immediately
            const newGameData = getGameData(message.data.category);
            webView.postMessage({
              type: 'gameData',
              data: newGameData,
            });
            
            // Then send current state
            webView.postMessage({
              type: 'initialData',
              data: {
                username,
                currentCounter: score,
              },
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
      console.log('Game data prepared for category:', category);
      console.log('Quote ID:', gameData.quoteData.id);
      console.log('Correct celebrity:', gameData.quoteData.correctCelebrity);
      console.log('Celebrities:', gameData.quoteData.celebrities);
      
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
          
          <vstack gap="medium" padding="medium">
            <text size="xlarge" color="white">Hear Say!?</text>
            <text size="large" color="white">Who Said That?</text>
          </vstack>
          
          <hstack gap="small">
            <text size="xlarge" color="white">Player: </text>
            <text size="xlarge" weight="bold" color="#F5F834">
              {isLoading ? 'Loading...' : username}
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
