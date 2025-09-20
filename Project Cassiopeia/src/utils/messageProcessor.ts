import { callGeminiAPI, clearConversationHistory } from './geminiService';
import { MessageProcessorResponse } from '../types/chat';
import { GoogleApiService } from './googleApi';
import { supabase } from '../lib/supabase';
import { availableFunctions } from './functions'; // update the path if needed


let conversationHistory: string[] = [];

let isAwaitingGemmaDecision = false;
let currentFunctionResults: Array<{ name: string; rawResult: string; displayContent: string | React.ReactNode }> = [];

export const processMessage = async (
  message: string,
  googleApi?: GoogleApiService,
  userUuid?: string,
  imageUrl?: string,
  videoUrl?: string,
  videoData?: { mimeType: string; data: string }
): Promise<MessageProcessorResponse> => {
  try {
    console.log('Processing message:', message, {
      hasImage: !!imageUrl,
      hasVideoUrl: !!videoUrl,
      hasVideoData: !!videoData,
      userUuid: userUuid ? 'Present' : 'Missing',
      isAwaitingGemmaDecision,
    });

    // Only add to history if not in the middle of sequential logic
    if (!isAwaitingGemmaDecision) {
      conversationHistory.push(`User: ${message}`);
    }

    // Inject memories once per session
    if (!isAwaitingGemmaDecision) {
      const memoryAlreadyInjected = conversationHistory.some(line =>
        line.includes('Gemma, here are the user\'s known memories.')
      );

      if (userUuid && !memoryAlreadyInjected) {
        const { data: memories, error } = await supabase
          .from('memories')
          .select('name, memory')
          .eq('user_uuid', userUuid);

        if (error) console.warn('Memory fetch error:', error.message);

        if (memories && memories.length > 0) {
          const memoryContext = memories
            .map(m => `- ${m.name}: ${m.memory}`)
            .join('\n');

          conversationHistory.push(
            `System: Gemma, here are the user's known memories. Consider them actively and proactively if relevant to the user's request:\n${memoryContext}`
          );
        }
      }
    }

    // Clean up old messages
    if (conversationHistory.length > 60) {
      conversationHistory = conversationHistory.slice(-30);
    }

    // 🔁 If awaiting decision: send the last functionResult as structured functionResponse
    if (isAwaitingGemmaDecision && currentFunctionResults.length > 0) {
      const lastResult = currentFunctionResults[currentFunctionResults.length - 1];

      const functionResponse = {
        functionResponse: {
          name: lastResult.name,
          response: {
            result: lastResult.rawResult
          }
        }
      };

      const followUp = await callGeminiAPI(functionResponse as any, conversationHistory, googleApi, userUuid);

      // Log result
      conversationHistory.push(`Gemma: ${followUp.content}`);

      // Clear or keep state based on whether there's another function
      isAwaitingGemmaDecision = !!followUp.functionCall;
      if (!isAwaitingGemmaDecision) {
        currentFunctionResults = [];
      }

      return {
        content: followUp.content,
        functionCall: followUp.functionCall
      };
    }

    // 🧠 Normal message path
    const response = await callGeminiAPI(
      message,
      conversationHistory,
      googleApi,
      userUuid,
      imageUrl,
      videoUrl,
      videoData
    );

    // 🚀 If Gemma triggered a function
    if (response.functionCall) {
      const { name, arguments: args, result, displayContent, isAwaitingNextStep } = response.functionCall;

      if (isAwaitingNextStep && googleApi && userUuid) {
        const funcDef = availableFunctions[name];
        if (funcDef) {
          try {
            const funcResult = await funcDef.handler(args, googleApi, userUuid);

            currentFunctionResults.push({
              name,
              rawResult: funcResult.rawResult,
              displayContent: funcResult.displayContent
            });

            isAwaitingGemmaDecision = true;

            conversationHistory.push(`Gemma: [Called ${name}]`);

            return {
              content: response.content,
              functionCall: {
                name,
                arguments: args,
                result: funcResult.rawResult,
                displayContent: funcResult.displayContent
              }
            };
          } catch (error) {
            console.error(`Error executing ${name}:`, error);
            return {
              content: `There was an error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
          }
        }
      } else {
        // Normal function call, not marked for next step
        currentFunctionResults.push({
          name,
          rawResult: result || '',
          displayContent: displayContent || ''
        });

        isAwaitingGemmaDecision = true;

        conversationHistory.push(`Gemma: [Called ${name}]`);

        return {
          content: response.content,
          functionCall: response.functionCall,
        };
      }
    } else {
      // ✨ Final response path (no more function calls)
      if (isAwaitingGemmaDecision) {
        isAwaitingGemmaDecision = false;
        currentFunctionResults = [];
        console.log('Final response received, clearing sequential state');
      }

      conversationHistory.push(`Gemma: ${response.content}`);
      return {
        content: response.content,
      };
    }
  } catch (error) {
    console.error('Message processing error:', error);

    isAwaitingGemmaDecision = false;
    currentFunctionResults = [];

    return {
      content: "I'm sorry, I encountered an error while processing your message. Please try again.",
    };
  }
};

export { clearConversationHistory };
