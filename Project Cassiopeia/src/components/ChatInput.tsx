import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Mic, MicOff, Square, Plus, X, Video, Youtube, Upload, Image, AudioLines } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string, imageUrl?: string, videoUrl?: string, videoData?: { mimeType: string; data: string }) => void;
  disabled?: boolean;
}

// Speech recognition types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<{ url?: string; data?: { mimeType: string; data: string }; name?: string } | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);


  useEffect(() => {
    // Check if speech recognition is supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognition);
  }, []);

useEffect(() => {
  const viewport = window.visualViewport;
  if (!viewport) return;

  let animationFrame: number;

  const handleViewportResize = () => {
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(() => {
      const offset = window.innerHeight - viewport.height - viewport.offsetTop;
      setKeyboardOffset(offset > 0 ? offset : 0);
    });
  };

  viewport.addEventListener('resize', handleViewportResize);
  viewport.addEventListener('scroll', handleViewportResize);

  // Initial check
  handleViewportResize();

  return () => {
    cancelAnimationFrame(animationFrame);
    viewport.removeEventListener('resize', handleViewportResize);
    viewport.removeEventListener('scroll', handleViewportResize);
  };
}, []);



  
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 10 * 24; // 10 lines * 24px line height
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((message.trim() || selectedImage || selectedVideo || youtubeUrl.trim()) && !disabled) {
      onSendMessage(
        message.trim(), 
        selectedImage || undefined, 
        youtubeUrl.trim() || selectedVideo?.url || undefined,
        selectedVideo?.data || undefined
      );
      setMessage('');
      setSelectedImage(null);
      setSelectedVideo(null);
      setYoutubeUrl('');
      setShowAttachmentMenu(false);
      setShowYoutubeInput(false);
    }
  };



  const handleImageSelect = () => {
    fileInputRef.current?.click();
    setShowAttachmentMenu(false);
  };

  const handleVideoSelect = () => {
    videoInputRef.current?.click();
    setShowAttachmentMenu(false);
  };

  const handleYoutubeOption = () => {
    setShowYoutubeInput(true);
    setShowAttachmentMenu(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setSelectedImage(result);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      const maxSize = 20 * 1024 * 1024; // 20MB
      
      if (file.size > maxSize) {
        alert('Video file is too large. Please select a video under 20MB or use a YouTube URL for larger videos.');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const [header, data] = result.split(',');
        const mimeType = file.type;
        
        setSelectedVideo({
          data: { mimeType, data },
          name: file.name
        });
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleYoutubeSubmit = () => {
    if (youtubeUrl.trim()) {
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/;
      if (!youtubeRegex.test(youtubeUrl.trim())) {
        alert('Please enter a valid YouTube URL');
        return;
      }
      
      setSelectedVideo({
        url: youtubeUrl.trim(),
        name: 'YouTube Video'
      });
      setShowYoutubeInput(false);
    }
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
  };

  const clearSelectedVideo = () => {
    setSelectedVideo(null);
    setYoutubeUrl('');
  };

  const handleVisionMode = () => {
    navigate('/vision');
  };

  const startListening = () => {
    if (!speechSupported) {
      console.warn('Speech recognition not supported');
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'es-ES';

      recognition.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        setMessage(finalTranscript || interimTranscript);
      };

      recognition.onend = () => {
        console.log('Speech recognition ended');
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        recognitionRef.current = null;
        
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access and try again.');
        } else if (event.error === 'no-speech') {
          console.log('No speech detected');
        } else {
          console.error('Speech recognition error:', event.error);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const hasContent = message.trim() || selectedImage || selectedVideo;

  return (
   <div
  className="fixed left-0 right-0 z-50 transition-all duration-300"
  style={{ bottom: `${keyboardOffset}px` }}
>

      {/* Media previews */}
      {(selectedImage || selectedVideo) && (
        <div className="bg-[#0b0c10]/95 backdrop-blur-sm border-t border-gray-700/30 px-4 py-3">
          <div className="max-w-4xl mx-auto flex flex-wrap gap-3">
            {/* Image preview */}
            {selectedImage && (
              <div className="relative">
                <img
                  src={selectedImage}
                  alt="Selected"
                  className="w-16 h-16 object-cover rounded-lg border border-gray-600/50"
                />
                <button
                  onClick={clearSelectedImage}
                  className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 transition-colors duration-200"
                  title="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Video preview */}
            {selectedVideo && (
              <div className="relative">
                <div className="w-16 h-16 bg-gray-700/50 rounded-lg border border-gray-600/50 flex items-center justify-center">
                  {selectedVideo.url ? <Youtube className="w-6 h-6 text-red-400" /> : <Video className="w-6 h-6 text-blue-400" />}
                </div>
                <button
                  onClick={clearSelectedVideo}
                  className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 transition-colors duration-200"
                  title="Remove video"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* YouTube URL input */}
      {showYoutubeInput && (
        <div className="bg-[#0b0c10]/95 backdrop-blur-sm border-t border-gray-700/30 px-4 py-3">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center space-x-3">
              <Youtube className="w-5 h-5 text-red-400 flex-shrink-0" />
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="Paste YouTube URL here..."
                className="flex-1 bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                autoFocus
              />
              <button
                onClick={handleYoutubeSubmit}
                disabled={!youtubeUrl.trim()}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                Add
              </button>
              <button
                onClick={() => setShowYoutubeInput(false)}
                className="p-2 text-gray-400 hover:text-white transition-colors duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment menu */}
      {showAttachmentMenu && (
        <div className="bg-[#0b0c10]/95 backdrop-blur-sm border-t border-gray-700/30 px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-3 gap-3 mb-3">
              {/* Photo option */}
              <button
                onClick={handleImageSelect}
                className="flex flex-col items-center space-y-2 p-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl border border-gray-600/30 transition-all duration-300 transform hover:scale-105"
              >
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Image className="w-6 h-6 text-blue-400" />
                </div>
                <span className="text-white text-sm font-medium">Photo</span>
              </button>

              {/* Video option */}
              <button
                onClick={handleVideoSelect}
                className="flex flex-col items-center space-y-2 p-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl border border-gray-600/30 transition-all duration-300 transform hover:scale-105"
              >
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <Video className="w-6 h-6 text-purple-400" />
                </div>
                <span className="text-white text-sm font-medium">Video</span>
              </button>

              {/* YouTube option */}
              <button
                onClick={handleYoutubeOption}
                className="flex flex-col items-center space-y-2 p-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl border border-gray-600/30 transition-all duration-300 transform hover:scale-105"
              >
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                  <Youtube className="w-6 h-6 text-red-400" />
                </div>
                <span className="text-white text-sm font-medium">YouTube</span>
              </button>
            </div>
            
            <button
              onClick={() => setShowAttachmentMenu(false)}
              className="w-full py-2 text-gray-400 hover:text-white transition-colors duration-200 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main input bar */}
      <div className="bg-[#0b0c10]/95 backdrop-blur-sm border-t border-gray-700/30 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit}>
            <div className={`flex items-end space-x-3 bg-gray-800/50 rounded-2xl border border-gray-600/50 p-3 transition-all duration-300 ${
              isFocused ? 'ring-2 ring-blue-500/50 border-blue-500/50' : ''
            } ${isListening ? 'ring-2 ring-red-500/50 border-red-500/50' : ''}`}>
              
              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoFileChange}
                className="hidden"
              />

              {/* Left side - Plus button */}
              <button
                type="button"
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                disabled={disabled}
                className="flex-shrink-0 w-11 h-11 bg-gray-700/50 hover:bg-gray-600/50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 hover:text-white rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 disabled:transform-none"
                title="Add attachment"
              >
                <Plus className="w-5 h-5" />
              </button>

              {/* Center - Text input */}
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  
                  onFocus={() => {
  setIsFocused(true);
  setTimeout(() => {
    textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}}
                  onBlur={() => setIsFocused(false)}
                  placeholder={isListening ? "Listening... Speak now" : "Ask Gemma"}
                  className="w-full bg-transparent text-white placeholder-gray-400 resize-none focus:outline-none text-base leading-6 max-h-60 overflow-y-auto"
                  rows={1}
                  disabled={disabled}
                  style={{ minHeight: '24px' }}
                />
              </div>

              {/* Right side - Mic and Vision/Send button */}
              <div className="flex items-center space-x-2">
                {/* Microphone button */}
                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={disabled}
                    className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:opacity-50 disabled:cursor-not-allowed ${
                      isListening
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse'
                        : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 hover:text-white'
                    }`}
                    title={isListening ? 'Stop listening' : 'Start voice input'}
                  >
                    {isListening ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                )}

                {/* Vision/Send button */}
                <button
                  type={hasContent ? "submit" : "button"}
                  onClick={hasContent ? undefined : handleVisionMode}
                  disabled={disabled}
                  className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:opacity-50 disabled:cursor-not-allowed ${
                    hasContent
                      ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl'
                      : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 hover:text-purple-300'
                  }`}
                  title={hasContent ? "Send message" : "Enter Gemma Vision mode"}
                >
                  {hasContent ? <Send className="w-5 h-5" /> : <AudioLines className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </form>

          {/* Status indicators */}
          {isListening && (
            <div className="mt-2 text-center">
              <p className="text-sm text-red-400 animate-pulse">
                🎤 Listening... Speak clearly and I'll transcribe your message
              </p>
            </div>
          )}
          
          {!speechSupported && (
            <div className="mt-2 text-center">
              <p className="text-xs text-gray-500">
                Voice input not supported in this browser
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}