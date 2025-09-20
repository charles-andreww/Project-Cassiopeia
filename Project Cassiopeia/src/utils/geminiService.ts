import { model, modelVision, isGeminiConfigured } from '../config/gemini';
import { availableFunctions } from './functions';
import { FunctionCall } from '../types/chat';
import { GoogleApiService } from './googleApi';

interface GeminiResponse {
  content: string;
  functionCall?: FunctionCall;
  isAwaitingNextStep?: boolean;
}

// Temporary storage for function results during sequential calling
const tempFunctionResults = new Map<string, { name: string; rawResult: string; displayContent: string | React.ReactNode }>();

// Global chat session to maintain conversation state
let chatSession: any = null;

// Convert our function definitions to Gemini's tools format
const tools = [{
  functionDeclarations: Object.values(availableFunctions).map(func => ({
    name: func.name,
    description: func.description,
    parameters: func.parameters,
  }))
}];

// Helper function to get current date context
const getCurrentDateContext = () => {
  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  const day = now.getDate();
  const year = now.getFullYear();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  
  return {
    today,
    dayOfWeek,
    month,
    day,
    year,
    time,
    formatted: `${dayOfWeek}, ${month} ${day}, ${year}`,
    iso: now.toISOString()
  };
};

// Helper function to parse data URL
const parseDataUrl = (dataUrl: string) => {
  const [header, data] = dataUrl.split(',');
  const mimeMatch = header.match(/data:([^;]+)/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  
  return {
    mimeType,
    data
  };
};

// Helper function to check if URL is a YouTube URL
const isYouTubeUrl = (url: string) => {
  return /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/.test(url);
};

export const callGeminiAPI = async (
  message: string, 
  conversationHistory: string[] = [],
  googleApi?: GoogleApiService,
  userUuid?: string,
  imageUrl?: string,
  videoUrl?: string,
  videoData?: { mimeType: string; data: string }
): Promise<GeminiResponse> => {
  if (!isGeminiConfigured || !model) {
    return {
      content: "I'm sorry, but I'm not properly configured right now. Please make sure the Gemini API key is set up correctly.",
    };
  }

  try {
    // Get current date context
    const dateContext = getCurrentDateContext();
    
    // Initialize chat session if needed
    if (!chatSession || conversationHistory.length === 0) {
      console.log('Initializing new chat session with tools and date context');
      
      // Convert conversation history to Gemini format
      const history = conversationHistory.map((entry, index) => ({
        role: index % 2 === 0 ? 'user' : 'model',
        parts: [{ text: entry.replace(/^(User|Gemma): /, '') }],
      }));

      chatSession = model.startChat({
        history,
        tools,
      });
    }

    // Enhance the message with current date context
    const enhancedMessage = `Current date and time context:
- Today's date: ${dateContext.today} (${dateContext.formatted})
- Current time: ${dateContext.time}
- Day of week: ${dateContext.dayOfWeek}

When the user refers to:
- "today" → use date: ${dateContext.today}
- "tomorrow" → use date: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
- "yesterday" → use date: ${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]}

User message: ${message}`;

    console.log('Sending enhanced message to Gemini with date context', {
      hasImage: !!imageUrl,
      hasVideoUrl: !!videoUrl,
      hasVideoData: !!videoData,
      userUuid: userUuid ? 'Present' : 'Missing'
    });
    
    // Prepare message parts
    const parts: any[] = [{ text: enhancedMessage }];
    
    // Add image if provided
    if (imageUrl) {
      try {
        const { mimeType, data } = parseDataUrl(imageUrl);
        parts.push({
          inlineData: {
            mimeType,
            data
          }
        });
        console.log('Image added to message parts:', mimeType);
      } catch (error) {
        console.error('Error parsing image data URL:', error);
        // Continue without image if parsing fails
      }
    }

    // Add video if provided
    if (videoUrl || videoData) {
      try {
        if (videoUrl && isYouTubeUrl(videoUrl)) {
          // YouTube video
          parts.push({
            fileData: {
              fileUri: videoUrl
            }
          });
          console.log('YouTube video added to message parts:', videoUrl);
        } else if (videoData) {
          // Inline video data
          parts.push({
            inlineData: {
              mimeType: videoData.mimeType,
              data: videoData.data
            }
          });
          console.log('Inline video added to message parts:', videoData.mimeType);
        } else if (videoUrl) {
          // Other video URL - treat as file URI
          parts.push({
            fileData: {
              fileUri: videoUrl
            }
          });
          console.log('Video URL added to message parts:', videoUrl);
        }
      } catch (error) {
        console.error('Error adding video to message parts:', error);
        // Continue without video if parsing fails
      }
    }
    
    // Send message to Gemini
    const result = await chatSession.sendMessage(parts);
    const response = await result.response;
    
    console.log('Raw Gemini response text:', response.text());
    
    console.log('Gemini response received');
    
// Check if Gemini wants to call a function (infinite loop)
let storedResults = [];
let currentResponse = response;

while (true) {
  const functionCalls = currentResponse.functionCalls();
  if (!functionCalls || functionCalls.length === 0) {
    break; // No more functions
  }

  const functionCall = functionCalls[0];
  console.log('Function call detected:', functionCall.name, functionCall.args);

  const functionDef = availableFunctions[functionCall.name];
  if (!functionDef) {
    console.error('Unknown function:', functionCall.name);
    return {
      content: `I don’t know how to run the function "${functionCall.name}".`,
    };
  }

  try {
    const functionResult = await functionDef.handler(functionCall.args, googleApi, userUuid);
    console.log('Function executed successfully:', functionResult);

    // Store in your temp results map (for compatibility with your current logic)
    const resultKey = `${functionCall.name}_${Date.now()}`;
    tempFunctionResults.set(resultKey, {
      name: functionCall.name,
      rawResult: functionResult.rawResult,
      displayContent: functionResult.displayContent,
    });

    // Also optionally collect for return
    storedResults.push({
      name: functionCall.name,
      rawResult: functionResult.rawResult,
      displayContent: functionResult.displayContent,
    });

    // Send the result back to Gemini
    const functionResponse = {
      functionResponse: {
        name: functionCall.name,
        response: { result: functionResult.rawResult },
      },
    };

    const followUpResult = await chatSession.sendMessage([functionResponse]);
    currentResponse = await followUpResult.response;

  } catch (error) {
    console.error('Function execution error:', error);

    // Clear storage
    tempFunctionResults.clear();

    // Send error back to Gemini
    const errorResponse = {
      functionResponse: {
        name: functionCall.name,
        response: { error: error instanceof Error ? error.message : 'Unknown error' },
      },
    };

    const errorResult = await chatSession.sendMessage([errorResponse]);
    const errorFollowUp = await errorResult.response;

    return {
      content: errorFollowUp.text(),
      functionCall: {
        name: functionCall.name,
        arguments: functionCall.args,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        displayContent: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

// ✅ All functions done – this is the final message
const finalContent = currentResponse.text();
tempFunctionResults.clear();

return {
  content: finalContent,
  functionCall: storedResults.length > 0
    ? {
        name: storedResults[storedResults.length - 1].name,
        arguments: {}, // optional, you could track this if you want
        result: storedResults[storedResults.length - 1].rawResult,
        displayContent: storedResults[storedResults.length - 1].displayContent,
      }
    : undefined,
};


    // Regular conversation without function calls
    // If we have stored function results, this might be a final response
    if (tempFunctionResults.size > 0) {
      // Clear temporary storage as this is the final response
      tempFunctionResults.clear();
    }
    
    return {
      content: response.text(),
    };

  } catch (error) {
    console.error('Gemini API error:', error);
    
    if (error instanceof Error && error.message.includes('API_KEY_INVALID')) {
      return {
        content: "It looks like there's an issue with my API configuration. Please check that the Gemini API key is valid.",
      };
    }
    
    return {
      content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
    };
  }
};

export const callGeminiVisionAPI = async (
  text: string,
  media: { mimeType: string, data: string }
): Promise<string> => {
  if (!isGeminiConfigured || !modelVision) {
    return "I'm sorry, but vision mode is not properly configured right now. Please make sure the Gemini API key is set up correctly.";
  }

  try {
    console.log('Sending vision request to Gemini');
    
    // Prepare message parts for vision
    const parts = [
      { text },
      {
        inlineData: {
          mimeType,
          data
        }
      }
    ];
    
    const visionSession = modelVision.startChat();
    const result = await visionSession.sendMessage(parts);
    const response = await result.response;
    
    console.log('Vision response received');
    return response.text();

  } catch (error) {
    console.error('Gemini Vision API error:', error);
    
    if (error instanceof Error && error.message.includes('API_KEY_INVALID')) {
      return "It looks like there's an issue with my API configuration.";
    }
    
    return "I'm having trouble processing the vision request right now.";
  }
};


// Function to clear conversation history and reset chat session
export const clearConversationHistory = () => {
  console.log('Clearing conversation history and resetting chat session');
  chatSession = null;
};