import type { Handler } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Allow': 'POST' }, body: 'Method Not Allowed' };
  }
  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return { statusCode: 500, body: 'Missing GEMINI_API_KEY in Netlify env' };

    const client = new GoogleGenAI({ apiKey: API_KEY });

    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString();

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        httpOptions: { apiVersion: 'v1alpha' },
        liveConnectConstraints: {
          model: 'gemini-live-2.5-flash-preview',
          config: { responseModalities: ['AUDIO', 'TEXT'] },
        },
      },
    });

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({ token: token.name, expireTime: token.expireTime }),
    };
  } catch (e: any) {
    console.error('ephemeral error', e?.response?.data || e);
    return { statusCode: 400, body: e?.message || 'Ephemeral token creation failed' };
  }
};
