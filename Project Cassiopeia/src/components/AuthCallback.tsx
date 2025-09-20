import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { user, loading } = useAuth(); // wait for auth to finish

  useEffect(() => {
    if (!loading && user) {
      navigate('/chat', { replace: true });
    }
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-[#0b0c10] flex items-center justify-center">
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
        <h2 className="text-xl text-white mb-2">Completing sign in...</h2>
        <p className="text-gray-400">You'll be redirected to the chat in a moment.</p>
      </div>
    </div>
  );
}