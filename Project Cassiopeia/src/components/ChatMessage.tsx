import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../types/chat';
import { Bot, User, Router, Calendar, Mail, MapPin, Plus, Sheet, FileText, Folder, Search, ChevronDown, ChevronUp, Video, CheckSquare, Youtube, Play } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === 'user';
  const [showFullFunctionCall, setShowFullFunctionCall] = useState(false);
  
  const getFunctionIcon = (functionName?: string) => {
    switch (functionName) {
      case 'firebase.servoCommand':
        return <Router className="w-4 h-4" />;
      case 'tomtom.getRouteInfo':
        return <MapPin className="w-4 h-4" />;
      case 'getCalendarEvents':
      case 'createCalendarEvent':
        return <Calendar className="w-4 h-4" />;
      case 'sendEmail':
      case 'getEmails':
        return <Mail className="w-4 h-4" />;
      case 'getSheetValues':
      case 'updateSheetValues':
      case 'createSpreadsheet':
        return <Sheet className="w-4 h-4" />;
      case 'createDocument':
      case 'getDocumentContent':
      case 'updateDocumentContent':
        return <FileText className="w-4 h-4" />;
      case 'searchDriveFiles':
        return <Folder className="w-4 h-4" />;
      case 'google_search.search':
        return <Search className="w-4 h-4" />;
      case 'createMeetMeeting':
      case 'getMeetMeetingInfo':
        return <Video className="w-4 h-4" />;
      case 'getTaskLists':
      case 'getTasks':
      case 'createTask':
      case 'updateTask':
      case 'deleteTask':
        return <CheckSquare className="w-4 h-4" />;
      default:
        return <Plus className="w-4 h-4" />;
    }
  };

  const getFunctionDisplayName = (functionName?: string) => {
    switch (functionName) {
        case 'firebase.servoCommand':
        return 'Servo Motor';
      case 'tomtom.getRouteInfo':
        return 'Maps';
      case 'getCalendarEvents':
      case 'createCalendarEvent':
        return 'Google Calendar';
      case 'sendEmail':
      case 'getEmails':
        return 'Gmail';
      case 'getSheetValues':
      case 'updateSheetValues':
      case 'createSpreadsheet':
        return 'Google Sheets';
      case 'createDocument':
      case 'getDocumentContent':
      case 'updateDocumentContent':
        return 'Google Docs';
      case 'searchDriveFiles':
        return 'Google Drive';
      case 'google_search.search':
        return 'Web Search';
      case 'createMeetMeeting':
      case 'getMeetMeetingInfo':
        return 'Google Meet';
      case 'getTaskLists':
      case 'getTasks':
      case 'createTask':
      case 'updateTask':
      case 'deleteTask':
        return 'Google Tasks';
      default:
        return functionName || 'Function';
    }
  };

  const isYouTubeUrl = (url: string) => {
    return /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/.test(url);
  };

  const getYouTubeEmbedUrl = (url: string) => {
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    if (videoIdMatch) {
      return `https://www.youtube.com/embed/${videoIdMatch[1]}`;
    }
    return url;
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      <div className={`flex items-start space-x-3 max-w-2xl ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser 
            ? 'bg-purple-500/20 text-purple-400' 
            : 'bg-blue-500/20 text-blue-400'
        }`}>
          {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
        </div>
        
        <div className={`rounded-2xl px-4 py-3 shadow-lg backdrop-blur-sm ${
          isUser
            ? 'bg-purple-500/20 border border-purple-500/30 text-white'
            : 'bg-gray-700/50 border border-gray-600/30 text-gray-100'
        }`}>
          {/* Display media if present (for user messages) */}
          {isUser && (
            <>
              {/* Image */}
              {message.imageUrl && (
                <div className="mb-3">
                  <img
                    src={message.imageUrl}
                    alt="User uploaded"
                    className="max-w-full max-h-64 rounded-lg border border-gray-600/30"
                  />
                </div>
              )}

              {/* Video */}
              {(message.videoUrl || message.videoData) && (
                <div className="mb-3">
                  {message.videoUrl && isYouTubeUrl(message.videoUrl) ? (
                    // YouTube video
                    <div className="relative">
                      <iframe
                        src={getYouTubeEmbedUrl(message.videoUrl)}
                        className="w-full h-48 rounded-lg border border-gray-600/30"
                        allowFullScreen
                        title="YouTube video"
                      />
                      <div className="absolute top-2 left-2 bg-red-500/80 text-white px-2 py-1 rounded text-xs font-medium flex items-center space-x-1">
                        <Youtube className="w-3 h-3" />
                        <span>YouTube</span>
                      </div>
                    </div>
                  ) : message.videoData ? (
                    // Uploaded video file
                    <div className="relative">
                      <video
                        controls
                        className="max-w-full max-h-64 rounded-lg border border-gray-600/30"
                        preload="metadata"
                      >
                        <source 
                          src={`data:${message.videoData.mimeType};base64,${message.videoData.data}`} 
                          type={message.videoData.mimeType} 
                        />
                        Your browser does not support the video tag.
                      </video>
                      <div className="absolute top-2 left-2 bg-blue-500/80 text-white px-2 py-1 rounded text-xs font-medium flex items-center space-x-1">
                        <Video className="w-3 h-3" />
                        <span>Video</span>
                      </div>
                    </div>
                  ) : message.videoUrl ? (
                    // Other video URL
                    <div className="relative">
                      <video
                        controls
                        className="max-w-full max-h-64 rounded-lg border border-gray-600/30"
                        preload="metadata"
                      >
                        <source src={message.videoUrl} />
                        Your browser does not support the video tag.
                      </video>
                      <div className="absolute top-2 left-2 bg-blue-500/80 text-white px-2 py-1 rounded text-xs font-medium flex items-center space-x-1">
                        <Play className="w-3 h-3" />
                        <span>Video</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}

          {/* Function Call Display */}
          {message.functionCall && (
            <div className="mb-3">
              {/* Function Header - Clickable */}
              <button
                onClick={() => setShowFullFunctionCall(!showFullFunctionCall)}
                className="w-full flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/15 transition-colors duration-200"
              >
                <div className="flex items-center space-x-2 text-blue-400 text-sm font-medium">
                  {getFunctionIcon(message.functionCall.name)}
                  <span>{getFunctionDisplayName(message.functionCall.name)}</span>
                </div>
                {showFullFunctionCall ? (
                  <ChevronUp className="w-4 h-4 text-blue-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-blue-400" />
                )}
              </button>

              {/* Function Display Content */}
              {message.functionCall.displayContent && (
                <div className="mt-3 p-3 bg-gray-800/30 border border-gray-600/20 rounded-lg">
                  <div className="text-sm text-gray-100">
                    {typeof message.functionCall.displayContent === 'string' ? (
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="text-gray-100 mb-2 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                          a: ({ children, href }) => (
                            <a 
                              href={href} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-blue-400 hover:text-blue-300 underline"
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {message.functionCall.displayContent}
                      </ReactMarkdown>
                    ) : (
                      message.functionCall.displayContent
                    )}
                  </div>
                </div>
              )}

              {/* Full Function Call Details - Collapsible */}
              {showFullFunctionCall && (
                <div className="mt-3 p-3 bg-gray-800/50 border border-gray-600/30 rounded-lg">
                  <div className="text-xs text-gray-400 font-mono space-y-2">
                    <div>
                      <span className="text-gray-300 font-semibold">Arguments:</span>
                      <pre className="mt-1 text-gray-400 whitespace-pre-wrap">
                        {JSON.stringify(message.functionCall.arguments, null, 2)}
                      </pre>
                    </div>
                    {message.functionCall.result && (
                      <div>
                        <span className="text-gray-300 font-semibold">Raw Result:</span>
                        <pre className="mt-1 text-gray-400 whitespace-pre-wrap">
                          {message.functionCall.result}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-bold text-white mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-bold text-white mb-1">{children}</h3>,
                  p: ({ children }) => <p className="text-gray-100 mb-2 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                  em: ({ children }) => <em className="italic text-gray-200">{children}</em>,
                  ul: ({ children }) => <ul className="list-disc list-inside text-gray-100 mb-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside text-gray-100 mb-2">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  hr: () => <hr className="border-gray-500 my-3" />,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-blue-400 pl-4 italic text-gray-200 my-2">
                      {children}
                    </blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full border border-gray-600 rounded-lg">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-gray-600/50">
                      {children}
                    </thead>
                  ),
                  tbody: ({ children }) => (
                    <tbody className="bg-gray-700/30">
                      {children}
                    </tbody>
                  ),
                  tr: ({ children }) => (
                    <tr className="border-b border-gray-600/50">
                      {children}
                    </tr>
                  ),
                  th: ({ children }) => (
                    <th className="px-3 py-2 text-left text-white font-semibold border-r border-gray-600/50 last:border-r-0">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 text-gray-100 border-r border-gray-600/50 last:border-r-0">
                      {children}
                    </td>
                  ),
                  code: ({ children, className }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-gray-600/50 px-1 py-0.5 rounded text-sm font-mono text-gray-100">
                        {children}
                      </code>
                    ) : (
                      <pre className="bg-gray-800/50 p-3 rounded-lg overflow-x-auto">
                        <code className="text-sm font-mono text-gray-100">{children}</code>
                      </pre>
                    );
                  },
                  a: ({ children, href }) => (
                    <a 
                      href={href} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
          
          <div className={`text-xs mt-2 opacity-60 ${isUser ? 'text-right' : 'text-left'}`}>
            {message.timestamp.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
        </div>
      </div>
    </div>
  );
}