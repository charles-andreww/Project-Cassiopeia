import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LogOut, Sparkles, User } from 'lucide-react';

export default function ChatHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleProfileClick = () => {
    navigate('/profile');
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-700/30">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">
                Gemma 🪄
              </h1>
              <p className="text-sm text-gray-400">
                your AI assistant
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleProfileClick}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-700/50 transition-all duration-200 group"
                title="View profile"
              >
                <img
                  src={user?.picture}
                  alt={user?.name}
                  className="w-8 h-8 rounded-full border-2 border-gray-600 group-hover:border-gray-500 transition-colors"
                />
                <div className="hidden sm:block text-left">
                  <p className="text-sm text-white font-medium group-hover:text-gray-200 transition-colors">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                    {user?.email}
                  </p>
                </div>
              </button>
            </div>
            
            <button
              onClick={signOut}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all duration-200"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}