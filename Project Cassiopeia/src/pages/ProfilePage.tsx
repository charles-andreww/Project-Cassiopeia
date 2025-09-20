import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ArrowLeft, User, Mail, Calendar, Shield, Sheet, FileText, Folder, Search, Video, CheckSquare } from 'lucide-react';

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const isRealAuth = user?.accessToken && user.accessToken !== 'demo_token';

  return (
    <div className="min-h-screen bg-[#0b0c10]">
      {/* Header */}
      <div className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-700/30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/chat')}
              className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Chat</span>
            </button>
            
            <h1 className="text-xl font-semibold text-white">Profile</h1>
            
            <button
              onClick={signOut}
              className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 rounded-lg transition-all duration-200"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* User Profile Section */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/30 mb-8">
          <div className="flex items-center space-x-6 mb-8">
            <img
              src={user?.picture}
              alt={user?.name}
              className="w-24 h-24 rounded-full border-4 border-gray-600"
            />
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">{user?.name}</h2>
              <p className="text-gray-400 text-lg mb-3">{user?.email}</p>
              <div className="flex items-center space-x-2 text-sm">
                <div className={`w-3 h-3 rounded-full ${isRealAuth ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                <span className={isRealAuth ? 'text-green-400' : 'text-yellow-400'}>
                  {isRealAuth ? 'Connected to Google Services' : 'Demo Mode - Limited Access'}
                </span>
              </div>
            </div>
          </div>

          {/* Account Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-700/30 rounded-xl p-6 border border-gray-600/30">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Account Details</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-400">User ID</p>
                  <p className="text-white font-mono text-sm">{user?.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Account Type</p>
                  <p className="text-white">{isRealAuth ? 'Google Account' : 'Demo Account'}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-700/30 rounded-xl p-6 border border-gray-600/30">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Shield className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Permissions</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Calendar Access</span>
                  <div className={`w-2 h-2 rounded-full ${isRealAuth ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Gmail Access</span>
                  <div className={`w-2 h-2 rounded-full ${isRealAuth ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Google Sheets</span>
                  <div className={`w-2 h-2 rounded-full ${isRealAuth ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Google Docs</span>
                  <div className={`w-2 h-2 rounded-full ${isRealAuth ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Google Drive</span>
                  <div className={`w-2 h-2 rounded-full ${isRealAuth ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Google Meet</span>
                  <div className={`w-2 h-2 rounded-full ${isRealAuth ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Google Tasks</span>
                  <div className={`w-2 h-2 rounded-full ${isRealAuth ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Profile Access</span>
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Available Features Section */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/30">
          <h3 className="text-xl font-semibold text-white mb-6">Available Features</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className={`p-6 rounded-xl border transition-all duration-200 ${
              isRealAuth 
                ? 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20' 
                : 'bg-gray-700/30 border-gray-600/30'
            }`}>
              <div className="flex items-center space-x-3 mb-3">
                <Calendar className={`w-6 h-6 ${isRealAuth ? 'text-blue-400' : 'text-gray-500'}`} />
                <h4 className={`font-semibold ${isRealAuth ? 'text-white' : 'text-gray-400'}`}>
                  Calendar Management
                </h4>
              </div>
              <p className={`text-sm ${isRealAuth ? 'text-gray-300' : 'text-gray-500'}`}>
                {isRealAuth 
                  ? 'View, create, and manage your Google Calendar events through AI commands.'
                  : 'Calendar features require Google authentication.'
                }
              </p>
              <div className="mt-3 text-xs">
                <span className={`px-2 py-1 rounded-full ${
                  isRealAuth 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-gray-600/20 text-gray-500'
                }`}>
                  {isRealAuth ? 'Active' : 'Requires Auth'}
                </span>
              </div>
            </div>

            <div className={`p-6 rounded-xl border transition-all duration-200 ${
              isRealAuth 
                ? 'bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20' 
                : 'bg-gray-700/30 border-gray-600/30'
            }`}>
              <div className="flex items-center space-x-3 mb-3">
                <Mail className={`w-6 h-6 ${isRealAuth ? 'text-purple-400' : 'text-gray-500'}`} />
                <h4 className={`font-semibold ${isRealAuth ? 'text-white' : 'text-gray-400'}`}>
                  Email Management
                </h4>
              </div>
              <p className={`text-sm ${isRealAuth ? 'text-gray-300' : 'text-gray-500'}`}>
                {isRealAuth 
                  ? 'Send emails and read your Gmail messages through natural language commands.'
                  : 'Email features require Google authentication.'
                }
              </p>
              <div className="mt-3 text-xs">
                <span className={`px-2 py-1 rounded-full ${
                  isRealAuth 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-gray-600/20 text-gray-500'
                }`}>
                  {isRealAuth ? 'Active' : 'Requires Auth'}
                </span>
              </div>
            </div>

            <div className={`p-6 rounded-xl border transition-all duration-200 ${
              isRealAuth 
                ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20' 
                : 'bg-gray-700/30 border-gray-600/30'
            }`}>
              <div className="flex items-center space-x-3 mb-3">
                <Sheet className={`w-6 h-6 ${isRealAuth ? 'text-green-400' : 'text-gray-500'}`} />
                <h4 className={`font-semibold ${isRealAuth ? 'text-white' : 'text-gray-400'}`}>
                  Google Sheets
                </h4>
              </div>
              <p className={`text-sm ${isRealAuth ? 'text-gray-300' : 'text-gray-500'}`}>
                {isRealAuth 
                  ? 'Create, read, and update Google Sheets spreadsheets with AI assistance.'
                  : 'Sheets features require Google authentication.'
                }
              </p>
              <div className="mt-3 text-xs">
                <span className={`px-2 py-1 rounded-full ${
                  isRealAuth 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-gray-600/20 text-gray-500'
                }`}>
                  {isRealAuth ? 'Active' : 'Requires Auth'}
                </span>
              </div>
            </div>

            <div className={`p-6 rounded-xl border transition-all duration-200 ${
              isRealAuth 
                ? 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20' 
                : 'bg-gray-700/30 border-gray-600/30'
            }`}>
              <div className="flex items-center space-x-3 mb-3">
                <FileText className={`w-6 h-6 ${isRealAuth ? 'text-orange-400' : 'text-gray-500'}`} />
                <h4 className={`font-semibold ${isRealAuth ? 'text-white' : 'text-gray-400'}`}>
                  Google Docs
                </h4>
              </div>
              <p className={`text-sm ${isRealAuth ? 'text-gray-300' : 'text-gray-500'}`}>
                {isRealAuth 
                  ? 'Create, read, and edit Google Docs documents through conversational AI.'
                  : 'Docs features require Google authentication.'
                }
              </p>
              <div className="mt-3 text-xs">
                <span className={`px-2 py-1 rounded-full ${
                  isRealAuth 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-gray-600/20 text-gray-500'
                }`}>
                  {isRealAuth ? 'Active' : 'Requires Auth'}
                </span>
              </div>
            </div>

            <div className={`p-6 rounded-xl border transition-all duration-200 ${
              isRealAuth 
                ? 'bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/20' 
                : 'bg-gray-700/30 border-gray-600/30'
            }`}>
              <div className="flex items-center space-x-3 mb-3">
                <Folder className={`w-6 h-6 ${isRealAuth ? 'text-yellow-400' : 'text-gray-500'}`} />
                <h4 className={`font-semibold ${isRealAuth ? 'text-white' : 'text-gray-400'}`}>
                  Google Drive
                </h4>
              </div>
              <p className={`text-sm ${isRealAuth ? 'text-gray-300' : 'text-gray-500'}`}>
                {isRealAuth 
                  ? 'Search and manage your Google Drive files with intelligent queries.'
                  : 'Drive features require Google authentication.'
                }
              </p>
              <div className="mt-3 text-xs">
                <span className={`px-2 py-1 rounded-full ${
                  isRealAuth 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-gray-600/20 text-gray-500'
                }`}>
                  {isRealAuth ? 'Active' : 'Requires Auth'}
                </span>
              </div>
            </div>

            <div className={`p-6 rounded-xl border transition-all duration-200 ${
              isRealAuth 
                ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20' 
                : 'bg-gray-700/30 border-gray-600/30'
            }`}>
              <div className="flex items-center space-x-3 mb-3">
                <Video className={`w-6 h-6 ${isRealAuth ? 'text-red-400' : 'text-gray-500'}`} />
                <h4 className={`font-semibold ${isRealAuth ? 'text-white' : 'text-gray-400'}`}>
                  Google Meet
                </h4>
              </div>
              <p className={`text-sm ${isRealAuth ? 'text-gray-300' : 'text-gray-500'}`}>
                {isRealAuth 
                  ? 'Create and manage Google Meet video conferences with AI commands.'
                  : 'Meet features require Google authentication.'
                }
              </p>
              <div className="mt-3 text-xs">
                <span className={`px-2 py-1 rounded-full ${
                  isRealAuth 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-gray-600/20 text-gray-500'
                }`}>
                  {isRealAuth ? 'Active' : 'Requires Auth'}
                </span>
              </div>
            </div>

            <div className={`p-6 rounded-xl border transition-all duration-200 ${
              isRealAuth 
                ? 'bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20' 
                : 'bg-gray-700/30 border-gray-600/30'
            }`}>
              <div className="flex items-center space-x-3 mb-3">
                <CheckSquare className={`w-6 h-6 ${isRealAuth ? 'text-indigo-400' : 'text-gray-500'}`} />
                <h4 className={`font-semibold ${isRealAuth ? 'text-white' : 'text-gray-400'}`}>
                  Google Tasks
                </h4>
              </div>
              <p className={`text-sm ${isRealAuth ? 'text-gray-300' : 'text-gray-500'}`}>
                {isRealAuth 
                  ? 'Manage your Google Tasks lists and to-do items through natural language.'
                  : 'Tasks features require Google authentication.'
                }
              </p>
              <div className="mt-3 text-xs">
                <span className={`px-2 py-1 rounded-full ${
                  isRealAuth 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-gray-600/20 text-gray-500'
                }`}>
                  {isRealAuth ? 'Active' : 'Requires Auth'}
                </span>
              </div>
            </div>

            <div className="p-6 rounded-xl border transition-all duration-200 bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20">
              <div className="flex items-center space-x-3 mb-3">
                <Search className="w-6 h-6 text-cyan-400" />
                <h4 className="font-semibold text-white">
                  Web Search
                </h4>
              </div>
              <p className="text-sm text-gray-300">
                Search the web for current information, news, facts, and real-time data.
              </p>
              <div className="mt-3 text-xs">
                <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                  Always Active
                </span>
              </div>
            </div>
          </div>

          {!isRealAuth && (
            <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-200 text-sm">
                <strong>Note:</strong> You're currently in demo mode. To access full Google Workspace functionality 
                (Calendar, Gmail, Sheets, Docs, Drive, Meet, Tasks), please sign out and sign in again with a real Google account 
                that has the necessary permissions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}