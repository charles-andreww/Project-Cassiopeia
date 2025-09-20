import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
  accessToken: string;
  refreshToken?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Google OAuth 2.0 configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = `${window.location.origin}/auth/callback`;

// Required scopes for our application - now includes Sheets, Docs, Drive, Meet, and Tasks
const SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/tasks'
].join(' ');

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Check if we're returning from OAuth callback
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (code && window.location.pathname === '/auth/callback') {
        await handleOAuthCallback(code, state);
        return;
      }

      // Check for stored user session
      const storedUser = localStorage.getItem('gemma_user');
      const storedToken = localStorage.getItem('gemma_access_token');
      
      if (storedUser && storedToken) {
        const userData = JSON.parse(storedUser);
        
        // Verify token is still valid
        if (await verifyToken(storedToken)) {
          setUser({ ...userData, accessToken: storedToken });
        } else {
          // Token expired, try to refresh
          const refreshToken = localStorage.getItem('gemma_refresh_token');
          if (refreshToken) {
            await refreshAccessToken(refreshToken);
          } else {
            // Clear invalid session
            clearStoredAuth();
          }
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      clearStoredAuth();
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthCallback = async (code: string, state: string | null) => {
    try {
      console.log('Handling OAuth callback with code:', code);
      
      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error('Token exchange failed:', errorData);
        throw new Error('Failed to exchange code for token');
      }

      const tokenData = await tokenResponse.json();
      console.log('Token response received:', {
        access_token: tokenData.access_token ? 'Present' : 'Missing',
        refresh_token: tokenData.refresh_token ? 'Present' : 'Missing',
        expires_in: tokenData.expires_in,
        scope: tokenData.scope
      });
      
      // Get user info using the access token
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.text();
        console.error('User info fetch failed:', errorData);
        throw new Error('Failed to get user info');
      }

      const userInfo = await userResponse.json();
      console.log('User info received:', {
        id: userInfo.id,
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture ? 'Present' : 'Missing'
      });

      const userData: User = {
        id: userInfo.id,
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
      };

      // Store user data and tokens
      localStorage.setItem('gemma_user', JSON.stringify({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        picture: userData.picture,
      }));
      localStorage.setItem('gemma_access_token', tokenData.access_token);
      
      if (tokenData.refresh_token) {
        localStorage.setItem('gemma_refresh_token', tokenData.refresh_token);
      }

      // Set token expiration time
      if (tokenData.expires_in) {
        const expirationTime = Date.now() + (tokenData.expires_in * 1000);
        localStorage.setItem('gemma_token_expires', expirationTime.toString());
      }

      console.log('User authentication completed successfully');
      setUser(userData);
    } catch (error) {
      console.error('OAuth callback error:', error);
      throw error;
    }
  };

  const verifyToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
      return response.ok;
    } catch {
      return false;
    }
  };

  const refreshAccessToken = async (refreshToken: string) => {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const tokenData = await response.json();
      
      // Update stored token
      localStorage.setItem('gemma_access_token', tokenData.access_token);
      
      if (tokenData.expires_in) {
        const expirationTime = Date.now() + (tokenData.expires_in * 1000);
        localStorage.setItem('gemma_token_expires', expirationTime.toString());
      }

      // Update user with new token
      const storedUser = localStorage.getItem('gemma_user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUser({ ...userData, accessToken: tokenData.access_token });
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      clearStoredAuth();
      throw error;
    }
  };

  const clearStoredAuth = () => {
    localStorage.removeItem('gemma_user');
    localStorage.removeItem('gemma_access_token');
    localStorage.removeItem('gemma_refresh_token');
    localStorage.removeItem('gemma_token_expires');
    setUser(null);
  };

  const signIn = async () => {
    if (!GOOGLE_CLIENT_ID) {
      // Fallback for demo when no client ID is configured
      const mockUser: User = {
        id: '1',
        name: 'Demo User',
        email: 'demo@example.com',
        picture: 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
        accessToken: 'demo_token',
      };
      setUser(mockUser);
      localStorage.setItem('gemma_user', JSON.stringify(mockUser));
      localStorage.setItem('gemma_access_token', 'demo_token');
      return;
    }

    try {
      // Generate state parameter for security
      const state = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('oauth_state', state);

      // Build OAuth URL
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', SCOPES);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      // Redirect to Google OAuth
      window.location.href = authUrl.toString();
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Revoke the access token
      const accessToken = localStorage.getItem('gemma_access_token');
      if (accessToken && accessToken !== 'demo_token') {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
          method: 'POST',
        });
      }
    } catch (error) {
      console.error('Error revoking token:', error);
    } finally {
      clearStoredAuth();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}