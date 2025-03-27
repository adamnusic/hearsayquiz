# Hear Say!? Quiz

A game where players guess which celebrity said a quote.

## Recent Improvements

### UI Enhancements
- Improved layout for the game to fit better in the webview popup
- Created a uniform 3x2 grid for celebrity buttons that's responsive to screen size
- Added support for celebrity images with initial-based fallbacks
- Improved visual design with hover effects and consistent styling
- Optimized spacing and padding throughout the interface

### Celebrity Images Support
- Added a `celebrity-images` directory in the webroot folder
- Implemented image loading for celebrities with fallback to colorful initial avatars
- Created a responsive grid that switches to 2 columns on smaller screens
- Standardized button height and image display across all celebrities

### Audio Functionality
- Fixed audio playback when selecting celebrities
- Ensured game conclusion works properly after audio playback
- Added better error handling for audio loading issues
- Created compact notifications for selection and results

## Directory Structure

```
webroot/
├── celebrity-images/     # Celebrity photos 
│   ├── bono.jpg
│   ├── taylor-swift.jpg
│   ├── beyonce.jpg
│   └── ...
├── audio/
│   └── music/            # Celebrity audio clips
│       ├── bono_music.mp3
│       ├── swift_music.mp3
│       └── ...
└── script.js             # Main game logic
```

## How to Play
1. Select a category
2. Read the displayed quote
3. Click on the celebrity you think said the quote
4. Hear the audio clip and see if you were correct
5. Earn points for correct answers

## Game Overview

Hear Say!? is a game where players:
1. Choose a category (Music, Politics, Movies, History, Sports, Academia)
2. See a famous quote and 6 different celebrities who could have said it
3. Have 20 seconds to choose the correct celebrity
4. Hear the celebrity saying the quote after making their selection
5. Earn points based on correct answers and speed

## Audio Files

The game requires audio clips of celebrities saying the quotes. Follow these steps to add your own audio files:

### Audio Directory Structure

Audio files are organized by category in the following directory structure:

```
webroot/audio/
├── academia/
├── history/
├── movies/
├── music/
├── politics/
└── sports/
```

### Audio Filename Format

Audio files should be named according to the following format:
`[celebrity_lastname]_[keyword].mp3`

For example:
- `einstein_imagination.mp3`
- `ali_float.mp3`
- `king_dream.mp3`

### Adding New Audio Files

1. Place your audio files in the appropriate category folder within `webroot/audio/`
2. Make sure the files are in MP3 format
3. Update the `MOCK_QUOTES` object in `src/main.tsx` if adding new quotes or celebrities

### Audio File Requirements

- Format: MP3
- Quality: Clear voice without background noise
- Duration: Short clips (5-15 seconds) of the celebrity saying the quote
- Size: Keep files under 1MB each for optimal performance

## Development

This game is built using:
- Devvit platform
- TypeScript/React for the main application
- HTML/CSS/JavaScript for the WebView component
- Web Audio API for sound effects

## Deployment

To deploy the game:
1. Make sure you have the Devvit CLI installed
2. Add your audio files to the appropriate directories
3. Run `devvit deploy` to deploy to Reddit

## Credits

Hear Say!? was created as a sample game for the Devvit platform. 