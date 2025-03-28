/** Message from Devvit to the web view. */
export type DevvitMessage =
  | { type: 'initialData'; data: { username: string; currentCounter: number } }
  | { type: 'updateCounter'; data: { currentCounter: number } }
  | { type: 'microphoneStatus'; data: { status: 'success' | 'error'; message: string } }
  | { type: 'gameData'; data: { category: string; quoteData: QuoteData } };

/** Message from the web view to Devvit. */
export type WebViewMessage =
  | { type: 'webViewReady' }
  | { type: 'setCounter'; data: { count: number } }
  | { type: 'microphoneInitiated' }
  | { type: 'microphoneData'; data: { audioData: string } }
  | { type: 'categorySelected'; data: { category: string } }
  | { type: 'quoteAnswered'; data: { selectedCelebrity: string; correct: boolean; score: number } }
  | { type: 'playAgain' }
  | { type: 'readyForGameData' };

/**
 * Web view MessageEvent listener data type. The Devvit API wraps all messages
 * from Blocks to the web view.
 */
export type DevvitSystemMessage = {
  data: { message: DevvitMessage };
  /** Reserved type for messages sent via `context.ui.webView.postMessage`. */
  type?: 'devvit-message' | string;
};

/**
 * Data structure for a quote in the Hear Say!? game
 */
export interface QuoteData {
  id: string;
  quote: string;
  correctCelebrity: string;
  celebrities: string[];
  audioClips: Record<string, string>;
  images: Record<string, string>;
}
