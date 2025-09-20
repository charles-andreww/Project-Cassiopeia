import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import ChatHeader from '../components/ChatHeader';
import { processMessage, clearConversationHistory } from '../utils/messageProcessor';
import { useGoogleApi } from '../utils/googleApi';
import { isGeminiConfigured } from '../config/gemini';
import { Message } from '../types/chat';
import { AlertCircle } from 'lucide-react';

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const googleApi = useGoogleApi();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };



  useEffect(() => {
    // Initialize conversation when component mounts
    clearConversationHistory();
    
    const welcomeMessage: Message = {
      id: '1',
      content: isGeminiConfigured 
        ? `Hello ${user?.name || 'there'}! I'm Gemma, your AI assistant with memory! 🧠 I can help you with calendar events, sending emails, managing Google Workspace documents, searching the web, analyzing images and videos, and much more. I can also remember important information for you - just ask me to remember something and I'll store it for future reference. What would you like to do today?`
        : `Hello ${user?.name || 'there'}! I'm Gemma, your AI assistant. However, I'm not fully configured right now because the Gemini API key is missing. Please add your API key to the .env file to enable my full capabilities.`,
      sender: 'gemma',
      timestamp: new Date(),
    };
    
    setMessages([welcomeMessage]);
  }, [user?.name]);

  const handleSendMessage = async (content: string, imageUrl?: string, videoUrl?: string, videoData?: { mimeType: string; data: string }) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date(),
      imageUrl,
      videoUrl,
      videoData,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      // Process message with Gemini API, Google API service, and user UUID
      const response = await processMessage(content, googleApi, user?.id, imageUrl, videoUrl, videoData);
      
      const gemmaMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.content,
        sender: 'gemma',
        timestamp: new Date(),
        functionCall: response.functionCall,
      };

      setMessages(prev => [...prev, gemmaMessage]);
    } catch (error) {
      console.error('Error processing message:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I encountered an error while processing your message. Please try again.",
        sender: 'gemma',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] flex flex-col">
      <ChatHeader />
      
      {!isGeminiConfigured && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg mx-4 mt-4 p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-yellow-200 text-sm font-medium">
                Gemini API Not Configured
              </p>
              <p className="text-yellow-300/80 text-xs mt-1">
                To enable full AI capabilities, add your Gemini API key to the .env file. 
                Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-200">Google AI Studio</a>.
              </p>
            </div>
          </div>
        </div>
      )}

      {!user?.accessToken || user.accessToken === 'demo_token' ? (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg mx-4 mt-4 p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-blue-200 text-sm font-medium">
                Limited Functionality
              </p>
              <p className="text-blue-300/80 text-xs mt-1">
                Using demo mode. Configure Google OAuth to access real Calendar, Gmail, and Google Workspace services.
              </p>
            </div>
          </div>
        </div>
      ) : null}
      
      <div className="flex-1 overflow-hidden pb-32">
        <div className="max-w-4xl mx-auto h-full flex flex-col px-4">
          <div className="flex-1 overflow-y-auto py-6 space-y-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-700/50 backdrop-blur-sm rounded-2xl px-4 py-3 max-w-xs">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
      
      <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
    </div>
  );
}