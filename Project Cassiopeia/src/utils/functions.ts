import { GoogleApiService } from './googleApi';
import { FunctionResult } from '../types/chat';
import { supabase } from '../lib/supabase';
import React from 'react';
import { getUserCoordinates } from './geoUtils'; // or wherever you place it



export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  handler: (args: Record<string, any>, googleApi?: GoogleApiService, userUuid?: string) => Promise<FunctionResult>;
}

const API_KEY = import.meta.env.VITE_TOMTOM_API_KEY;

// 🧭 Helper: Get coordinates from place name
async function getCoordinates(place: string): Promise<{ lat: number; lon: number }> {
  const url = new URL(`https://api.tomtom.com/search/2/geocode/${encodeURIComponent(place)}.json`);
  url.searchParams.set('key', API_KEY);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to geocode location "${place}"`);
  }

  const data = await response.json();
  if (!data.results?.length) {
    throw new Error(`Could not find coordinates for "${place}"`);
  }

  const position = data.results[0].position;
  return { lat: position.lat, lon: position.lon };
}

// 🚗 Main Route Handler 
export const handleTomTomRoute = async (args: {
  origin: string;
  destination: string;
}): Promise<FunctionResult> => {
  const { origin, destination } = args;

  if (!API_KEY) {
    const errorMessage = `TomTom API key is missing. Please configure VITE_TOMTOM_API_KEY in your environment.`;
    return {
      rawResult: errorMessage,
      displayContent: errorMessage,
    };
  }

  try {
    console.log('Fetching route from TomTom API:', { origin, destination });

    const [startCoords, endCoords] = await Promise.all([
      getCoordinates(origin),
      getCoordinates(destination),
    ]);

    const url = new URL(
      `https://api.tomtom.com/routing/1/calculateRoute/${startCoords.lat},${startCoords.lon}:${endCoords.lat},${endCoords.lon}/json`
    );
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('traffic', 'true');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok || !data.routes?.length) {
      throw new Error(`TomTom API error: ${JSON.stringify(data)}`);
    }

    const route = data.routes[0];
    const summary = route.summary;
    const steps = route.guidance?.instructions || [];

    const distanceKm = (summary.lengthInMeters / 1000).toFixed(1);
    const travelTimeMin = Math.round(summary.travelTimeInSeconds / 60);
    const delayMin = Math.round(summary.trafficDelayInSeconds / 60);

    let displayContent = `🗺️ **Route Summary**

**From:** ${origin}  
**To:** ${destination}  
**Distance:** ${distanceKm} km  
**Estimated Time:** ${travelTimeMin} min`;

    if (delayMin > 0) {
      displayContent += `\n**Traffic Delay:** ${delayMin} min`;
    }

    

    return {
      rawResult: JSON.stringify(data, null, 2),
      displayContent,
    };
  } catch (error) {
    console.error('TomTom Route Fetch Error:', error);
    const errorMessage = `Sorry, I couldn't retrieve route details. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return {
      rawResult: errorMessage,
      displayContent: errorMessage,
    };
  }
};
export const handleFirebaseGetSensorData = async (): Promise<FunctionResult> => {
  const FIREBASE_URL = import.meta.env.VITE_FIREBASE_DB_URL;
  const PATH = '/sensorData.json';

  if (!FIREBASE_URL) {
    const msg = `Missing Firebase Realtime DB URL. Please set VITE_FIREBASE_DB_URL in your .env.`;
    return { rawResult: msg, displayContent: msg };
  }

  try {
    const res = await fetch(`${FIREBASE_URL}${PATH}`);
    const sensorData = await res.json();

    const { temperature, humidity, lastUpdate } = sensorData;

    const getRelativeTime = (unix: number): string => {
      const now = Date.now();
      const diff = now - unix;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins === 1) return '1 minute ago';
      return `${mins} minutes ago`;
    };

    const formattedTime = getRelativeTime(lastUpdate);

    const displayContent = `
🌡️ **Sensor Readings:**
• Temperature: ${temperature}°C
• Humidity: ${humidity}%
• Last updated: ${formattedTime}
`;

    const rawResult = JSON.stringify({
      temperature,
      humidity,
      lastUpdated: formattedTime, // <- parsed here!
    }, null, 2);

    return {
      rawResult,
      displayContent,
    };
  } catch (error) {
    const msg = `Failed to retrieve sensor data: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: msg, displayContent: msg };
  }
};



// Firebase: Update servo command
export const handleFirebaseUpdateServoCommand = async (args: {
  from: number;
  to: number;
  delayBefore: number;
  delayAfter: number;
  status: 'active' | 'loop' | 'completed';
}): Promise<FunctionResult> => {
  const { from, to, delayBefore, delayAfter, status } = args;

  const FIREBASE_URL = import.meta.env.VITE_FIREBASE_DB_URL;
  const PATH = '/servoCommand.json';
  const FIREBASE_SECRET = import.meta.env.VITE_FIREBASE_SECRET;

  if (!FIREBASE_URL) {
    const msg = `Missing Firebase Realtime DB URL. Please set VITE_FIREBASE_DB_URL in your .env.`;
    return { rawResult: msg, displayContent: msg };
  }

  try {
    const body = {
      from,
      to,
      delayBefore,
      delayAfter,
      status
    };

    const res = await fetch(`${FIREBASE_URL}${PATH}?auth=${FIREBASE_SECRET}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Firebase error: ${res.status} - ${err}`);
    }

    const displayContent = `✅ Servo command updated:
• From: ${from}°
• To: ${to}°
• Delay before: ${delayBefore} ms
• Delay after: ${delayAfter} ms
• Status: **${status}**`;

    return {
      rawResult: JSON.stringify(body, null, 2),
      displayContent
    };
  } catch (error) {
    const msg = `Failed to update Firebase: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: msg, displayContent: msg };
  }
};


//TomTom place searching
export const handleTomTomSearchPlace = async (args: { query: string; lat?: number; lon?: number }): Promise<FunctionResult> => {
  let { query, lat, lon } = args;
  const API_KEY = import.meta.env.VITE_TOMTOM_API_KEY;

  if (!lat || !lon) {
    try {
      const coords = await getUserCoordinates();
      lat = coords.lat;
      lon = coords.lon;
      console.log('Using user’s current location:', coords);
    } catch (error) {
      const msg = `❌ I couldn't access your location. Please allow location access or provide a specific place.`;
      return { rawResult: msg, displayContent: msg };
    }
  }

  const url = `https://api.tomtom.com/search/2/poiSearch/${encodeURIComponent(query)}.json?lat=${lat}&lon=${lon}&radius=5000&limit=5&view=Unified&key=${API_KEY}`;

  try {
    console.log('Searching nearby places:', { query, lat, lon });

    const res = await fetch(url);
    const data = await res.json();

    const places = data.results || [];

    if (places.length === 0) {
      const msg = `😕 No places found for "${query}" near your location.`;
      return { rawResult: msg, displayContent: msg };
    }

    const rawResult = JSON.stringify(places, null, 2);

    const displayContent = `🍽️ **Nearby "${query}" results:**\n\n${places.map((p, i) => 
      `**${i + 1}.** ${p.poi.name}\n📍 ${p.address.freeformAddress}`
    ).join('\n\n')}\n\nLet me know which one you want directions to!`;

    return { rawResult, displayContent };
  } catch (err) {
    const msg = `❌ Failed to search for "${query}". Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
    return { rawResult: msg, displayContent: msg };
  }
};
//TomTom Get route
export const handleTomTomGetRoute = async (args: { startLat: number; startLon: number; endLat: number; endLon: number }): Promise<FunctionResult> => {
  const { startLat, startLon, endLat, endLon } = args;

  const API_KEY = import.meta.env.VITE_TOMTOM_API_KEY;
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${startLat},${startLon}:${endLat},${endLon}/json?traffic=true&key=${API_KEY}`;

  try {
    console.log('Fetching route:', { startLat, startLon, endLat, endLon });

    const res = await fetch(url);
    const data = await res.json();

    const summary = data.routes?.[0]?.summary;
    if (!summary) throw new Error('No route found');

    const rawResult = JSON.stringify(data, null, 2);

    const displayContent = `🚗 **Route Summary**  
📍 Distance: ${(summary.lengthInMeters / 1000).toFixed(1)} km  
🕒 Duration: ${(summary.travelTimeInSeconds / 60).toFixed(0)} minutes  
📥 [Open in Google Maps](https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLon}&destination=${endLat},${endLon})`;

    return { rawResult, displayContent };
  } catch (err) {
    const msg = `Failed to fetch route. Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
    return { rawResult: msg, displayContent: msg };
  }
};


// Memory Management Functions
export const saveMemory = async (args: { name: string; memory: string }, googleApi?: GoogleApiService, userUuid?: string): Promise<FunctionResult> => {
  const { name, memory } = args;
  
  if (!userUuid) {
    const errorMessage = 'User authentication required to save memories.';
    return { rawResult: errorMessage, displayContent: errorMessage };
  }

  if (!supabase) {
    const errorMessage = 'Memory system not configured. Please set up Supabase connection.';
    return { rawResult: errorMessage, displayContent: errorMessage };
  }

  try {
    console.log('Saving memory:', { name, memory, userUuid });
    
    // Use upsert to either insert new memory or update existing one
    const { data, error } = await supabase
      .from('memories')
      .upsert(
        {
          user_uuid: userUuid,
          name: name,
          memory: memory,
        },
        {
          onConflict: 'user_uuid,name'
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error saving memory:', error);
      throw error;
    }

    console.log('Memory saved successfully:', data);
    
    const rawResult = `✓ Memory "${name}" saved successfully: ${memory}`;
    
    const displayContent = `**Memory Saved Successfully** ✓

🧠 **"${name}"**
📝 ${memory}
📅 ${new Date().toLocaleDateString()}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Memory save error:', error);
    const errorMessage = `Sorry, I couldn't save the memory. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

export const getMemory = async (args: { name: string }, googleApi?: GoogleApiService, userUuid?: string): Promise<FunctionResult> => {
  const { name } = args;
  
  if (!userUuid) {
    const errorMessage = 'User authentication required to retrieve memories.';
    return { rawResult: errorMessage, displayContent: errorMessage };
  }

  if (!supabase) {
    const errorMessage = 'Memory system not configured. Please set up Supabase connection.';
    return { rawResult: errorMessage, displayContent: errorMessage };
  }

  try {
    console.log('Retrieving memory:', { name, userUuid });
    
    const { data, error } = await supabase
      .from('memories')
      .select('memory, created_at, updated_at')
      .eq('user_uuid', userUuid)
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        const notFoundMessage = `I don't have any memory saved with the name "${name}".`;
        return { rawResult: notFoundMessage, displayContent: notFoundMessage };
      }
      console.error('Error retrieving memory:', error);
      throw error;
    }

    console.log('Memory retrieved successfully:', data);
    
    const rawResult = `Memory "${name}": ${data.memory}`;
    
    const displayContent = `**Memory Retrieved** 🧠

**"${name}"**
📝 ${data.memory}
📅 Saved: ${new Date(data.created_at).toLocaleDateString()}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Memory retrieval error:', error);
    const errorMessage = `Sorry, I couldn't retrieve the memory. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

export const getAllMemories = async (args: {}, googleApi?: GoogleApiService, userUuid?: string): Promise<FunctionResult> => {
  if (!userUuid) {
    const errorMessage = 'User authentication required to retrieve memories.';
    return { rawResult: errorMessage, displayContent: errorMessage };
  }

  if (!supabase) {
    const errorMessage = 'Memory system not configured. Please set up Supabase connection.';
    return { rawResult: errorMessage, displayContent: errorMessage };
  }

  try {
    console.log('Retrieving all memories for user:', userUuid);
    
    const { data, error } = await supabase
      .from('memories')
      .select('name, memory, created_at, updated_at')
      .eq('user_uuid', userUuid)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error retrieving memories:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      const noMemoriesMessage = 'You don\'t have any saved memories yet.';
      return { rawResult: noMemoriesMessage, displayContent: noMemoriesMessage };
    }

    console.log('All memories retrieved successfully:', data.length);
    
    const rawResult = `Found ${data.length} saved memories:\n\n${data.map(memory => 
      `**${memory.name}**: ${memory.memory} (saved: ${new Date(memory.created_at).toLocaleDateString()})`
    ).join('\n')}`;
    
    const displayContent = `**${data.length} Saved Memories** 🧠

${data.map(memory => 
  `**"${memory.name}"**
📝 ${memory.memory}
📅 ${new Date(memory.created_at).toLocaleDateString()}`
).join('\n\n')}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('All memories retrieval error:', error);
    const errorMessage = `Sorry, I couldn't retrieve your memories. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

export const deleteMemory = async (args: { name: string }, googleApi?: GoogleApiService, userUuid?: string): Promise<FunctionResult> => {
  const { name } = args;
  
  if (!userUuid) {
    const errorMessage = 'User authentication required to delete memories.';
    return { rawResult: errorMessage, displayContent: errorMessage };
  }

  if (!supabase) {
    const errorMessage = 'Memory system not configured. Please set up Supabase connection.';
    return { rawResult: errorMessage, displayContent: errorMessage };
  }

  try {
    console.log('Deleting memory:', { name, userUuid });
    
    const { data, error } = await supabase
      .from('memories')
      .delete()
      .eq('user_uuid', userUuid)
      .eq('name', name)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        const notFoundMessage = `I don't have any memory saved with the name "${name}" to delete.`;
        return { rawResult: notFoundMessage, displayContent: notFoundMessage };
      }
      console.error('Error deleting memory:', error);
      throw error;
    }

    console.log('Memory deleted successfully:', data);
    
    const rawResult = `✓ Memory "${name}" deleted successfully.`;
    
    const displayContent = `**Memory Deleted Successfully** ✓

🗑️ **"${name}"**
📝 The memory has been permanently removed`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Memory deletion error:', error);
    const errorMessage = `Sorry, I couldn't delete the memory. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

// Google Custom Search function
export const handleGoogleSearch = async (args: { query: string; numResults?: number }): Promise<FunctionResult> => {
  const { query, numResults = 10 } = args;
  
  const API_KEY = import.meta.env.VITE_GOOGLE_CUSTOM_SEARCH_API_KEY;
  const SEARCH_ENGINE_ID = import.meta.env.VITE_GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
  
  if (!API_KEY || !SEARCH_ENGINE_ID) {
    const fallbackResult = `I don't have access to web search right now. Please configure the Google Custom Search API key and Search Engine ID in your environment variables.`;
    return {
      rawResult: fallbackResult,
      displayContent: fallbackResult
    };
  }

  try {
    console.log('Performing Google Custom Search:', { query, numResults });
    
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('cx', SEARCH_ENGINE_ID);
    url.searchParams.set('q', query);
    url.searchParams.set('num', Math.min(numResults, 10).toString());

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Custom Search API error:', errorText);
      throw new Error(`Search API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Custom Search API response:', data);

    const items = data.items || [];
    
    if (items.length === 0) {
      const noResultsMessage = `No search results found for "${query}".`;
      return {
        rawResult: noResultsMessage,
        displayContent: noResultsMessage
      };
    }

    // Format results for display
    const searchResults = items.map((item: any, index: number) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      displayLink: item.displayLink
    }));

    const rawResult = JSON.stringify(searchResults, null, 2);
    
    // For web search, we only show a simple confirmation in displayContent
    // The actual search results are processed by Gemini and included in the main response
    const displayContent = `🔍 **Web Search Completed**

**Query:** ${query}
**Results Found:** ${items.length}`;

    return {
      rawResult,
      displayContent
    };
  } catch (error) {
    console.error('Google Custom Search error:', error);
    const errorMessage = `Sorry, I couldn't perform the web search. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return {
      rawResult: errorMessage,
      displayContent: errorMessage
    };
  }
};

// Enhanced function handlers with display content
export const getCalendarEvents = async (args: { date: string }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { date } = args;
  
  if (!googleApi) {
    // Fallback to mock data
    await new Promise(resolve => setTimeout(resolve, 500));
    const mockEvents = [
      { time: '9:00 AM', title: 'Team standup meeting' },
      { time: '2:00 PM', title: 'Project review with client' },
      { time: '4:30 PM', title: 'Doctor appointment' },
    ];
    const rawResult = `Found ${mockEvents.length} events for ${date}:\n${mockEvents.map(e => `• ${e.time}: ${e.title}`).join('\n')}`;
    
    const displayContent = `**${mockEvents.length}** event${mockEvents.length === 1 ? '' : 's'} on ${date}:

${mockEvents.map(e => `• **${e.time}** - ${e.title}`).join('\n')}`;

    return { rawResult, displayContent };
  }

  try {
    console.log(`Fetching calendar events for ${date}`);
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const response = await googleApi.getCalendarEvents(
      startOfDay.toISOString(),
      endOfDay.toISOString()
    );

    const events = response.items || [];
    
    if (events.length === 0) {
      const noEventsMessage = `No events found for ${date}.`;
      return { rawResult: noEventsMessage, displayContent: noEventsMessage };
    }

    const eventList = events.map((event: any) => {
  const startTime = event.start?.dateTime 
    ? new Date(event.start.dateTime).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: event.start.timeZone || 'Europe/Madrid'
      })
    : 'All day';
  return { time: startTime, title: event.summary || 'Untitled event' };
});


    const rawResult = `Found ${events.length} event${events.length === 1 ? '' : 's'} for ${date}:\n${eventList.map(e => `• ${e.time}: ${e.title}`).join('\n')}`;
    
    const displayContent = `**${events.length}** event${events.length === 1 ? '' : 's'} on ${date}:

${eventList.map(e => `• **${e.time}** - ${e.title}`).join('\n')}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Calendar API error:', error);
    const errorMessage = `Sorry, I couldn't fetch your calendar events. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

export const createCalendarEvent = async (args: { summary: string; start: string; end: string; description?: string }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { summary, start, end, description } = args;
  
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 800));
    const rawResult = `✓ Calendar event "${summary}" created successfully for ${new Date(start).toLocaleDateString()} at ${new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    
    const displayContent = `**Event Created Successfully** ✓

**${summary}**
📅 ${new Date(start).toLocaleDateString()}
🕐 ${new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
${description ? `📝 ${description}` : ''}`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Creating calendar event:', { summary, start, end, description });
    
   const event = {
  summary,
  description: description || '',
  start: {
    dateTime: start, // DON'T parse it with new Date
    timeZone: 'Europe/Madrid', // or use UTC if start is already in UTC
  },
  end: {
    dateTime: end,
    timeZone: 'Europe/Madrid',
  },
};



    const response = await googleApi.createCalendarEvent(event);
    console.log('Calendar event created:', response);

    const eventDate = new Date(start).toLocaleDateString();
    const eventTime = new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const rawResult = `✓ Calendar event "${summary}" created successfully for ${eventDate} at ${eventTime}.`;
    
    const displayContent = `**Event Created Successfully** ✓

**${summary}**
📅 ${eventDate}
🕐 ${eventTime} - ${endTime}
${description ? `📝 ${description}` : ''}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Calendar creation error:', error);
    const errorMessage = `Sorry, I couldn't create the calendar event. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

export const sendEmail = async (args: { to: string; subject: string; body: string }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { to, subject, body } = args;
  
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 800));
    const rawResult = `✓ Email sent successfully to ${to} with subject "${subject}". The recipient will receive it shortly.`;
    
    const displayContent = `**Email Sent Successfully** ✓

**To:** ${to}
**Subject:** ${subject}
**Preview:** ${body.substring(0, 100)}${body.length > 100 ? '...' : ''}`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Sending email:', { to, subject, bodyLength: body.length });
    
    await googleApi.sendEmail(to, subject, body);
    console.log('Email sent successfully');
    
    const rawResult = `✓ Email sent successfully to ${to} with subject "${subject}".`;
    
    const displayContent = `**Email Sent Successfully** ✓

**To:** ${to}
**Subject:** ${subject}
**Preview:** ${body.substring(0, 100)}${body.length > 100 ? '...' : ''}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Gmail API error:', error);
    const errorMessage = `Sorry, I couldn't send the email. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

export const getEmails = async (args: { maxResults?: number; query?: string }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { maxResults = 10, query } = args;
  
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 600));
    const mockEmails = [
      { 
        from: 'john@example.com', 
        subject: 'Project Update', 
        date: 'Today 2:30 PM',
        body: 'Hi there! Just wanted to give you a quick update on the project...'
      },
      { 
        from: 'sarah@company.com', 
        subject: 'Meeting Tomorrow', 
        date: 'Today 1:15 PM',
        body: 'Don\'t forget about our meeting tomorrow at 10 AM...'
      },
    ];
    
    const rawResult = `Found **${mockEmails.length}** recent emails:\n\n${mockEmails.map(e => 
      `**From:** ${e.from}\n**Subject:** ${e.subject}\n**Date:** ${e.date}\n**Preview:** ${e.body.substring(0, 100)}...`
    ).join('\n\n---\n\n')}`;

    const displayContent = `**${mockEmails.length}** Recent Email${mockEmails.length === 1 ? '' : 's'}:

${mockEmails.map(e => 
  `📧 **${e.subject}**
From: ${e.from}
${e.date}`
).join('\n\n')}`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Fetching emails:', { maxResults, query });
    
    const response = await googleApi.getEmails(maxResults, query);
    const messages = response.messages || [];
    
    if (messages.length === 0) {
      const noEmailsMessage = query ? `No emails found matching "${query}".` : 'No recent emails found.';
      return { rawResult: noEmailsMessage, displayContent: noEmailsMessage };
    }

    const emailDetails = await Promise.all(
      messages.slice(0, Math.min(5, messages.length)).map(async (message: any) => {
        try {
          const details = await googleApi.getEmailDetails(message.id);
          const headers = details.payload?.headers || [];
          
          const getHeader = (name: string) => {
            const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
            return header?.value || 'Unknown';
          };

          const body = googleApi.extractEmailBody(details.payload);
          

          return {
  id: message.id,
  threadId: details.threadId,
  from: getHeader('From'),
  subject: getHeader('Subject'),
  date: getHeader('Date'),
  body, // full body
  labelIds: details.labelIds,
};

        } catch (error) {
          return {
            from: 'Unknown',
            subject: 'Unable to load',
            date: 'Unknown',
            body: 'Content unavailable',
          };
        }
      })
    );

    const rawResult = `Found **${messages.length}** email${messages.length === 1 ? '' : 's'}${query ? ` matching "${query}"` : ''}:\n\n${emailDetails.map(email => 
      `**From:** ${email.from}\n**Subject:** ${email.subject}\n**Date:** ${email.date}\n**Preview:** ${email.body}`
    ).join('\n\n---\n\n')}`;

    const displayContent = `**${messages.length}** Email${messages.length === 1 ? '' : 's'} Found:

${emailDetails.map(email => 
  `📧 **${email.subject}**
From: ${email.from}
${new Date(email.date).toLocaleDateString()}`
).join('\n\n')}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Gmail API error:', error);
    const errorMessage = `Sorry, I couldn't fetch your emails. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

// Google Sheets functions
export const getSheetValues = async (args: { spreadsheetId: string; range: string }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { spreadsheetId, range } = args;
  
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 600));
    const mockData = [
      ['Name', 'Email', 'Department'],
      ['John Doe', 'john@company.com', 'Engineering'],
      ['Jane Smith', 'jane@company.com', 'Marketing'],
    ];
    
    const rawResult = `Spreadsheet Data (${range})\n\n${mockData.map(row => 
      `| ${row.join(' | ')} |`
    ).join('\n')}`;

    const displayContent = `**Spreadsheet Data Retrieved**

📊 **Range:** ${range}
📈 **Rows:** ${mockData.length}

${mockData.map(row => `| ${row.join(' | ')} |`).join('\n')}`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Fetching sheet values:', { spreadsheetId, range });
    
    const response = await googleApi.getSheetValues(spreadsheetId, range);
    const values = response.values || [];
    
    if (values.length === 0) {
      const noDataMessage = `No data found in range ${range}.`;
      return { rawResult: noDataMessage, displayContent: noDataMessage };
    }

    const rawResult = `Spreadsheet Data (${range})\n\nFound **${values.length}** row${values.length === 1 ? '' : 's'} of data:\n\n${values.map((row: any[]) => 
      `| ${row.join(' | ')} |`
    ).join('\n')}`;

    const displayContent = `**Spreadsheet Data Retrieved**

📊 **Range:** ${range}
📈 **Rows:** ${values.length}

${values.map((row: any[]) => `| ${row.join(' | ')} |`).join('\n')}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Sheets API error:', error);
    const errorMessage = `Sorry, I couldn't fetch the spreadsheet data. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

export const updateSheetValues = async (args: { spreadsheetId: string; range: string; values: any[][] }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { spreadsheetId, range, values } = args;
  
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 800));
    const rawResult = `✓ Successfully updated ${values.length} row${values.length === 1 ? '' : 's'} in range ${range}.`;
    
    const displayContent = `**Spreadsheet Updated Successfully** ✓

📊 **Range:** ${range}
📝 **Rows Updated:** ${values.length}
📈 **Data Preview:**
${values.slice(0, 3).map(row => `| ${row.join(' | ')} |`).join('\n')}${values.length > 3 ? '\n...' : ''}`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Updating sheet values:', { spreadsheetId, range, values });
    
    const response = await googleApi.updateSheetValues(spreadsheetId, range, values);
    console.log('Sheet updated successfully:', response);
    
    const rawResult = `✓ Successfully updated ${values.length} row${values.length === 1 ? '' : 's'} in range ${range}.`;
    
    const displayContent = `**Spreadsheet Updated Successfully** ✓

📊 **Range:** ${range}
📝 **Rows Updated:** ${values.length}
📈 **Data Preview:**
${values.slice(0, 3).map(row => `| ${row.join(' | ')} |`).join('\n')}${values.length > 3 ? '\n...' : ''}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Sheets update error:', error);
    const errorMessage = `Sorry, I couldn't update the spreadsheet. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

export const createSpreadsheet = async (args: { title: string }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { title } = args;
  
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 800));
    const rawResult = `✓ Spreadsheet "${title}" created successfully. (Demo mode - no actual file created)`;
    
    const displayContent = `**Spreadsheet Created Successfully** ✓

📊 **${title}**
🆔 Demo Mode - No actual file created
🔗 Configure Google OAuth for full functionality`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Creating spreadsheet:', title);
    
    const response = await googleApi.createSpreadsheet(title);
    console.log('Spreadsheet created:', response);
    
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${response.spreadsheetId}`;
    
    const rawResult = `✓ Spreadsheet **"${title}"** created successfully!\n\n**Spreadsheet ID:** ${response.spreadsheetId}\n**URL:** ${spreadsheetUrl}`;
    
    const displayContent = `**Spreadsheet Created Successfully** ✓

📊 **${title}**
🆔 ${response.spreadsheetId}
🔗 [Open Spreadsheet](${spreadsheetUrl})`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Spreadsheet creation error:', error);
    const errorMessage = `Sorry, I couldn't create the spreadsheet. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

// Google Docs functions
export const createDocument = async (args: { title: string }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { title } = args;
  
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 800));
    const rawResult = `✓ Document "${title}" created successfully. (Demo mode - no actual file created)`;
    
    const displayContent = `**Document Created Successfully** ✓

📄 **${title}**
🆔 Demo Mode - No actual file created
🔗 Configure Google OAuth for full functionality`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Creating document:', title);
    
    const response = await googleApi.createDocument(title);
    console.log('Document created:', response);
    
    const documentUrl = `https://docs.google.com/document/d/${response.documentId}`;
    
    const rawResult = `✓ Document **"${title}"** created successfully!\n\n**Document ID:** ${response.documentId}\n**URL:** ${documentUrl}`;
    
    const displayContent = `**Document Created Successfully** ✓

📄 **${title}**
🆔 ${response.documentId}
🔗 [Open Document](${documentUrl})`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Document creation error:', error);
    const errorMessage = `Sorry, I couldn't create the document. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

export const getDocumentContent = async (args: { documentId: string }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { documentId } = args;
  
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 600));
    const rawResult = `Document Content\n\n**Document ID:** ${documentId}\n\n**Content:**\nThis is a sample document content. In demo mode, I can't access real Google Docs.`;
    
    const displayContent = `**Document Content Retrieved**

📄 **Document ID:** ${documentId}
📝 **Content Preview:** Sample document content (Demo mode)`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Fetching document content:', documentId);
    
    const response = await googleApi.getDocumentContent(documentId);
    console.log('Document content fetched successfully');
    
    const title = response.title || 'Untitled Document';
    const content = googleApi.extractDocumentText(response);
    
    if (!content.trim()) {
      const emptyMessage = `Document "${title}" appears to be empty or contains no readable text content.`;
      return { rawResult: emptyMessage, displayContent: emptyMessage };
    }
    
    const rawResult = `${title}\n\n**Document ID:** ${documentId}\n\n**Content:**\n${content}`;
    
    const displayContent = `**Document Content Retrieved**

📄 **${title}**
🆔 ${documentId}
📝 **Content Preview:** ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Document content error:', error);
    const errorMessage = `Sorry, I couldn't fetch the document content. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

export const updateDocumentContent = async (args: { documentId: string; text: string; insertIndex?: number }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { documentId, text, insertIndex = 1 } = args;
  
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 800));
    const rawResult = `✓ Document updated successfully with new content.`;
    
    const displayContent = `**Document Updated Successfully** ✓

📄 **Document ID:** ${documentId}
📝 **Content Added:** ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Updating document content:', { documentId, text, insertIndex });
    
    const requests = [
      {
        insertText: {
          location: {
            index: insertIndex,
          },
          text: text,
        },
      },
    ];
    
    const response = await googleApi.updateDocumentContent(documentId, requests);
    console.log('Document updated successfully:', response);
    
    const rawResult = `✓ Document updated successfully with new content.`;
    
    const displayContent = `**Document Updated Successfully** ✓

📄 **Document ID:** ${documentId}
📝 **Content Added:** ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Document update error:', error);
    const errorMessage = `Sorry, I couldn't update the document. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

// Google Drive functions
export const searchDriveFiles = async (args: { query: string; maxResults?: number }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { query, maxResults = 10 } = args;
  
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 600));
    const mockFiles = [
      { name: 'Project Proposal.docx', type: 'Document', modified: '2 days ago' },
      { name: 'Budget Spreadsheet.xlsx', type: 'Spreadsheet', modified: '1 week ago' },
    ];
    
    const rawResult = `Drive Search Results\n\nFound **${mockFiles.length}** files matching "${query}":\n\n${mockFiles.map(file => 
      `**${file.name}**\n- Type: ${file.type}\n- Modified: ${file.modified}`
    ).join('\n\n')}`;

    const displayContent = `**${mockFiles.length}** File${mockFiles.length === 1 ? '' : 's'} Found:

${mockFiles.map(file => 
  `📁 **${file.name}**
${file.type} • ${file.modified}`
).join('\n\n')}`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Searching Drive files:', { query, maxResults });
    
    const response = await googleApi.searchDriveFiles(query, maxResults);
    const files = response.files || [];
    
    if (files.length === 0) {
      const noFilesMessage = `No files found matching "${query}".`;
      return { rawResult: noFilesMessage, displayContent: noFilesMessage };
    }

    const fileList = files.map((file: any) => {
      const fileType = file.mimeType?.includes('spreadsheet') ? 'Spreadsheet' :
                      file.mimeType?.includes('document') ? 'Document' :
                      file.mimeType?.includes('presentation') ? 'Presentation' :
                      file.mimeType?.includes('folder') ? 'Folder' : 'File';
      
      const modifiedDate = file.modifiedTime ? 
        new Date(file.modifiedTime).toLocaleDateString() : 'Unknown';
      
      return {
        name: file.name,
        type: fileType,
        modified: modifiedDate,
        id: file.id,
        link: file.webViewLink
      };
    });

    const rawResult = `Drive Search Results\n\nFound **${files.length}** file${files.length === 1 ? '' : 's'} matching "${query}":\n\n${fileList.map(file => 
      `**${file.name}**\n- Type: ${file.type}\n- Modified: ${file.modified}\n- ID: ${file.id}${file.link ? `\n- [View File](${file.link})` : ''}`
    ).join('\n\n')}`;

    const displayContent = `**${files.length}** File${files.length === 1 ? '' : 's'} Found:

${fileList.map(file => 
  `📁 **${file.name}**
${file.type} • ${file.modified}${file.link ? `\n🔗 [Open File](${file.link})` : ''}`
).join('\n\n')}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Drive search error:', error);
    const errorMessage = `Sorry, I couldn't search your Drive files. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

// Google Meet functions
export const createMeetMeeting = async (args: { displayName?: string }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { displayName } = args;
  
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 800));
    const rawResult = `✓ Google Meet space created successfully. (Demo mode - no actual meeting created)`;
    
    const displayContent = `**Google Meet Created Successfully** ✓

🎥 **Meeting Space**
${displayName ? `📝 **Name:** ${displayName}` : ''}
🔗 Demo Mode - Configure Google OAuth for full functionality`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Creating Google Meet space:', displayName);
    
    const response = await googleApi.createMeetSpace(displayName);
    console.log('Meet space created:', response);
    
    const meetingUrl = response.meetingUri || 'Meeting URL not available';
    const spaceId = response.name?.split('/').pop() || 'Unknown';
    
    const rawResult = `✓ Google Meet space created successfully!\n\n**Space ID:** ${spaceId}\n**Meeting URL:** ${meetingUrl}`;
    
    const displayContent = `**Google Meet Created Successfully** ✓

🎥 **Meeting Space**
${displayName ? `📝 **Name:** ${displayName}` : ''}
🆔 ${spaceId}
🔗 [Join Meeting](${meetingUrl})`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Meet creation error:', error);
    const errorMessage = `Sorry, I couldn't create the Google Meet. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

export const getMeetMeetingInfo = async (args: { spaceId: string }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { spaceId } = args;
  
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 600));
    const rawResult = `Google Meet Space Info\n\n**Space ID:** ${spaceId}\n\n**Status:** Demo mode - no actual meeting info available`;
    
    const displayContent = `**Google Meet Info Retrieved**

🎥 **Space ID:** ${spaceId}
📝 **Status:** Demo mode`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Fetching Google Meet space info:', spaceId);
    
    const response = await googleApi.getMeetSpace(spaceId);
    console.log('Meet space info fetched:', response);
    
    const meetingUrl = response.meetingUri || 'Not available';
    const config = response.config || {};
    
    const rawResult = `Google Meet Space Info\n\n**Space ID:** ${spaceId}\n**Meeting URL:** ${meetingUrl}\n**Access Type:** ${config.accessType || 'Unknown'}`;
    
    const displayContent = `**Google Meet Info Retrieved**

🎥 **Space ID:** ${spaceId}
🔗 **Meeting URL:** ${meetingUrl}
🔒 **Access:** ${config.accessType || 'Unknown'}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Meet info error:', error);
    const errorMessage = `Sorry, I couldn't fetch the Google Meet info. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

// Google Tasks functions
export const getTaskLists = async (args: {}, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 600));
    const mockLists = [
      { id: 'list1', title: 'My Tasks' },
      { id: 'list2', title: 'Work Projects' },
    ];
    
    const rawResult = `Task Lists\n\n${mockLists.map(list => `**${list.title}** (ID: ${list.id})`).join('\n')}`;
    
    const displayContent = `**${mockLists.length}** Task List${mockLists.length === 1 ? '' : 's'}:

${mockLists.map(list => `📋 **${list.title}**`).join('\n')}`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Fetching task lists');
    
    const response = await googleApi.getTaskLists();
    const lists = response.items || [];
    
    if (lists.length === 0) {
      const noListsMessage = 'No task lists found.';
      return { rawResult: noListsMessage, displayContent: noListsMessage };
    }

    const rawResult = `Task Lists\n\n${lists.map((list: any) => `**${list.title}** (ID: ${list.id})`).join('\n')}`;
    
    const displayContent = `**${lists.length}** Task List${lists.length === 1 ? '' : 's'}:

${lists.map((list: any) => `📋 **${list.title}**`).join('\n')}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Tasks API error:', error);
    const errorMessage = `Sorry, I couldn't fetch your task lists. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

export const getTasks = async (args: { taskListId: string; maxResults?: number }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { taskListId, maxResults = 100 } = args;
  
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 600));
    const mockTasks = [
      { title: 'Complete project proposal', status: 'needsAction', due: '2024-01-15' },
      { title: 'Review team feedback', status: 'completed', due: null },
    ];
    
    const rawResult = `Tasks from list ${taskListId}\n\n${mockTasks.map(task => 
      `**${task.title}**\n- Status: ${task.status}\n- Due: ${task.due || 'No due date'}`
    ).join('\n\n')}`;

    const displayContent = `**${mockTasks.length}** Task${mockTasks.length === 1 ? '' : 's'}:

${mockTasks.map(task => 
  `${task.status === 'completed' ? '✅' : '📝'} **${task.title}**
${task.due ? `📅 Due: ${task.due}` : ''}`
).join('\n\n')}`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Fetching tasks from list:', taskListId);
    
    const response = await googleApi.getTasks(taskListId, maxResults);
    const tasks = response.items || [];
    
    if (tasks.length === 0) {
      const noTasksMessage = 'No tasks found in this list.';
      return { rawResult: noTasksMessage, displayContent: noTasksMessage };
    }

    const rawResult = `Tasks from list ${taskListId}\n\n${tasks.map((task: any) => 
      `**${task.title}**\n- Status: ${task.status}\n- Due: ${task.due ? new Date(task.due).toLocaleDateString() : 'No due date'}`
    ).join('\n\n')}`;

    const displayContent = `**${tasks.length}** Task${tasks.length === 1 ? '' : 's'}:

${tasks.map((task: any) => 
  `${task.status === 'completed' ? '✅' : '📝'} **${task.title}**
${task.due ? `📅 Due: ${new Date(task.due).toLocaleDateString()}` : ''}`
).join('\n\n')}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Tasks API error:', error);
    const errorMessage = `Sorry, I couldn't fetch the tasks. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

export const createTask = async (args: { taskListId: string; title: string; notes?: string; due?: string }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { taskListId, title, notes, due } = args;
  
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 800));
    const rawResult = `✓ Task "${title}" created successfully in list ${taskListId}.`;
    
    const displayContent = `**Task Created Successfully** ✓

📝 **${title}**
${notes ? `📄 ${notes}` : ''}
${due ? `📅 Due: ${due}` : ''}`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Creating task:', { taskListId, title, notes, due });
    
    const response = await googleApi.createTask(taskListId, title, notes, due);
    console.log('Task created:', response);
    
    const rawResult = `✓ Task "${title}" created successfully in list ${taskListId}.`;
    
    const displayContent = `**Task Created Successfully** ✓

📝 **${title}**
${notes ? `📄 ${notes}` : ''}
${due ? `📅 Due: ${new Date(due).toLocaleDateString()}` : ''}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Task creation error:', error);
    const errorMessage = `Sorry, I couldn't create the task. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

export const updateTask = async (args: { taskListId: string; taskId: string; updates: any }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { taskListId, taskId, updates } = args;
  
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 800));
    const rawResult = `✓ Task updated successfully.`;
    
    const displayContent = `**Task Updated Successfully** ✓

📝 **Task ID:** ${taskId}
📄 **Updates:** ${Object.keys(updates).join(', ')}`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Updating task:', { taskListId, taskId, updates });
    
    const response = await googleApi.updateTask(taskListId, taskId, updates);
    console.log('Task updated:', response);
    
    const rawResult = `✓ Task updated successfully.`;
    
    const displayContent = `**Task Updated Successfully** ✓

📝 **${response.title || 'Task'}**
${updates.status === 'completed' ? '✅ Marked as completed' : ''}
${updates.title ? `📄 Title updated` : ''}
${updates.due ? `📅 Due date updated` : ''}`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Task update error:', error);
    const errorMessage = `Sorry, I couldn't update the task. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

export const deleteTask = async (args: { taskListId: string; taskId: string }, googleApi?: GoogleApiService): Promise<FunctionResult> => {
  const { taskListId, taskId } = args;
  
  if (!googleApi) {
    await new Promise(resolve => setTimeout(resolve, 800));
    const rawResult = `✓ Task deleted successfully.`;
    
    const displayContent = `**Task Deleted Successfully** ✓

📝 **Task ID:** ${taskId}
🗑️ **Action:** Permanently removed`;

    return { rawResult, displayContent };
  }

  try {
    console.log('Deleting task:', { taskListId, taskId });
    
    await googleApi.deleteTask(taskListId, taskId);
    console.log('Task deleted successfully');
    
    const rawResult = `✓ Task deleted successfully.`;
    
    const displayContent = `**Task Deleted Successfully** ✓

📝 **Task ID:** ${taskId}
🗑️ **Action:** Permanently removed`;

    return { rawResult, displayContent };
  } catch (error) {
    console.error('Task deletion error:', error);
    const errorMessage = `Sorry, I couldn't delete the task. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return { rawResult: errorMessage, displayContent: errorMessage };
  }
};

export const availableFunctions: Record<string, FunctionDefinition> = {
'firebase.getSensorData': {
  name: 'firebase.getSensorData',
  description: 'Get the current temperature, humidity, and last update time from the sensor in Firebase Realtime Database.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: handleFirebaseGetSensorData,
},

'firebase.servoCommand': {
  name: 'firebase.servoCommand',
  description: 'Update the servoCommand object in Firebase Realtime Database with new angle positions, delays and status.',
  parameters: {
    type: 'object',
    properties: {
      from: {
        type: 'number',
        description: 'The starting angle of the servo in degrees (e.g. 0)',
      },
      to: {
        type: 'number',
        description: 'The target angle of the servo in degrees (e.g. 180)',
      },
      delayBefore: {
        type: 'number',
        description: 'Delay in milliseconds before moving the servo',
      },
      delayAfter: {
        type: 'number',
        description: 'Delay in milliseconds after moving the servo',
      },
      status: {
        type: 'string',
        enum: ['active', 'loop', 'completed'],
        description: 'Defines how the servo should behave: once (active), repeated (loop), or stopped (completed)',
      },
    },
    required: ['from', 'to', 'delayBefore', 'delayAfter', 'status'],
  },
  handler: handleFirebaseUpdateServoCommand,
},


  
  'tomtom.searchPlace': {
  name: 'tomtom.searchPlace',
  description: 'Search for nearby places using a query and user location',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The keyword for place search, like "restaurant" or "KFC"' },
      lat: { type: 'number', description: 'Latitude of current user location' },
      lon: { type: 'number', description: 'Longitude of current user location' }
    },
    required: ['query', 'lat', 'lon'],
  },
  handler: handleTomTomSearchPlace,
},

  
  'tomtom.getRouteInfo': {
  name: 'tomtom.getRouteInfo',
  description: 'Get estimated travel time and traffic delay between two locations using TomTom Routing API',
  parameters: {
    type: 'object',
    properties: {
      origin: {
        type: 'string',
        description: 'Starting point (e.g., "Barcelona, Spain")',
      },
      destination: {
        type: 'string',
        description: 'Destination point (e.g., "Madrid, Spain")',
      },
    },
    required: ['origin', 'destination'],
  },
  handler: handleTomTomRoute,
},

  'tomtom.getRoute': {
  name: 'tomtom.getRoute',
  description: 'Get a route between two coordinates and optionally open it in Google Maps',
  parameters: {
    type: 'object',
    properties: {
      startLat: { type: 'number' },
      startLon: { type: 'number' },
      endLat: { type: 'number' },
      endLon: { type: 'number' },
    },
    required: ['startLat', 'startLon', 'endLat', 'endLon'],
  },
  handler: handleTomTomGetRoute,
},


  'google_search.search': {
    name: 'google_search.search',
    description: 'Search the web for current information, news, facts, or any information not available through other integrated tools',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to execute',
        },
        numResults: {
          type: 'number',
          description: 'Number of search results to return (default: 10, max: 10)',
        },
      },
      required: ['query'],
    },
    handler: handleGoogleSearch,
  },

  // Memory Management Functions
  saveMemory: {
    name: 'saveMemory',
    description: 'Save important information that the user wants you to remember',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'A short, descriptive name or key for the memory (e.g., "parking_spot", "favorite_color")',
        },
        memory: {
          type: 'string',
          description: 'The actual content of the memory to save',
        },
      },
      required: ['name', 'memory'],
    },
    handler: saveMemory,
  },

  getMemory: {
    name: 'getMemory',
    description: 'Retrieve a previously saved memory by its name',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name or key of the memory to retrieve',
        },
      },
      required: ['name'],
    },
    handler: getMemory,
  },

  getAllMemories: {
    name: 'getAllMemories',
    description: 'Retrieve all saved memories for the user',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: getAllMemories,
  },

  deleteMemory: {
    name: 'deleteMemory',
    description: 'Delete a saved memory by its name',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name or key of the memory to delete',
        },
      },
      required: ['name'],
    },
    handler: deleteMemory,
  },

  getCalendarEvents: {
    name: 'getCalendarEvents',
    description: 'Get calendar events for a specific date',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format',
        },
      },
      required: ['date'],
    },
    handler: getCalendarEvents,
  },
  
  createCalendarEvent: {
    name: 'createCalendarEvent',
    description: 'Create a new calendar event',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Event title/summary',
        },
        start: {
          type: 'string',
          description: 'Event start time in ISO format (e.g., 2024-01-15T10:00:00)',
        },
        end: {
          type: 'string',
          description: 'Event end time in ISO format (e.g., 2024-01-15T11:00:00)',
        },
        description: {
          type: 'string',
          description: 'Optional event description',
        },
      },
      required: ['summary', 'start', 'end'],
    },
    handler: createCalendarEvent,
  },
  
  sendEmail: {
    name: 'sendEmail',
    description: 'Send an email to a recipient',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        body: {
          type: 'string',
          description: 'Email body content',
        },
      },
      required: ['to', 'subject', 'body'],
    },
    handler: sendEmail,
  },
  
  getEmails: {
    name: 'getEmails',
    description: 'Get recent emails from Gmail',
    parameters: {
      type: 'object',
      properties: {
        maxResults: {
          type: 'number',
          description: 'Maximum number of emails to retrieve (default: 10)',
        },
        query: {
          type: 'string',
          description: 'Optional search query to filter emails',
        },
      },
      required: [],
    },
    handler: getEmails,
  },

  getSheetValues: {
    name: 'getSheetValues',
    description: 'Get values from a Google Sheets spreadsheet',
    parameters: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'The ID of the Google Sheets spreadsheet',
        },
        range: {
          type: 'string',
          description: 'The range to read (e.g., "Sheet1!A1:C10" or "A:C")',
        },
      },
      required: ['spreadsheetId', 'range'],
    },
    handler: getSheetValues,
  },

  updateSheetValues: {
    name: 'updateSheetValues',
    description: 'Update values in a Google Sheets spreadsheet',
    parameters: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'The ID of the Google Sheets spreadsheet',
        },
        range: {
          type: 'string',
          description: 'The range to update (e.g., "Sheet1!A1:C10")',
        },
        values: {
          type: 'array',
          description: 'Array of arrays containing the values to write',
          items: {
            type: 'array',
            items: { type: 'string' }
          },
        },
      },
      required: ['spreadsheetId', 'range', 'values'],
    },
    handler: updateSheetValues,
  },

  createSpreadsheet: {
    name: 'createSpreadsheet',
    description: 'Create a new Google Sheets spreadsheet',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The title for the new spreadsheet',
        },
      },
      required: ['title'],
    },
    handler: createSpreadsheet,
  },

  createDocument: {
    name: 'createDocument',
    description: 'Create a new Google Docs document',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The title for the new document',
        },
      },
      required: ['title'],
    },
    handler: createDocument,
  },

  getDocumentContent: {
    name: 'getDocumentContent',
    description: 'Get the content of a Google Docs document',
    parameters: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Docs document',
        },
      },
      required: ['documentId'],
    },
    handler: getDocumentContent,
  },

  updateDocumentContent: {
    name: 'updateDocumentContent',
    description: 'Add text content to a Google Docs document',
    parameters: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Docs document',
        },
        text: {
          type: 'string',
          description: 'The text content to add to the document',
        },
        insertIndex: {
          type: 'number',
          description: 'The index where to insert the text (default: 1 for beginning)',
        },
      },
      required: ['documentId', 'text'],
    },
    handler: updateDocumentContent,
  },

  searchDriveFiles: {
    name: 'searchDriveFiles',
    description: 'Search for files in Google Drive',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (can include file names, types, etc.)',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
      },
      required: ['query'],
    },
    handler: searchDriveFiles,
  },

  createMeetMeeting: {
    name: 'createMeetMeeting',
    description: 'Create a new Google Meet meeting space',
    parameters: {
      type: 'object',
      properties: {
        displayName: {
          type: 'string',
          description: 'Optional display name for the meeting',
        },
      },
      required: [],
    },
    handler: createMeetMeeting,
  },

  getMeetMeetingInfo: {
    name: 'getMeetMeetingInfo',
    description: 'Get information about a Google Meet space',
    parameters: {
      type: 'object',
      properties: {
        spaceId: {
          type: 'string',
          description: 'The ID of the Google Meet space',
        },
      },
      required: ['spaceId'],
    },
    handler: getMeetMeetingInfo,
  },

  getTaskLists: {
    name: 'getTaskLists',
    description: 'Get all Google Tasks lists for the user',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: getTaskLists,
  },

  getTasks: {
    name: 'getTasks',
    description: 'Get tasks from a specific Google Tasks list',
    parameters: {
      type: 'object',
      properties: {
        taskListId: {
          type: 'string',
          description: 'The ID of the task list',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of tasks to retrieve (default: 100)',
        },
      },
      required: ['taskListId'],
    },
    handler: getTasks,
  },

  createTask: {
    name: 'createTask',
    description: 'Create a new task in a Google Tasks list',
    parameters: {
      type: 'object',
      properties: {
        taskListId: {
          type: 'string',
          description: 'The ID of the task list',
        },
        title: {
          type: 'string',
          description: 'The title of the task',
        },
        notes: {
          type: 'string',
          description: 'Optional notes for the task',
        },
        due: {
          type: 'string',
          description: 'Optional due date in ISO format (e.g., 2024-01-15T10:00:00Z)',
        },
      },
      required: ['taskListId', 'title'],
    },
    handler: createTask,
  },

  updateTask: {
    name: 'updateTask',
    description: 'Update an existing task in Google Tasks',
    parameters: {
      type: 'object',
      properties: {
        taskListId: {
          type: 'string',
          description: 'The ID of the task list',
        },
        taskId: {
          type: 'string',
          description: 'The ID of the task to update',
        },
        updates: {
          type: 'object',
          description: 'Object containing the fields to update (title, notes, status, due, etc.)',
        },
      },
      required: ['taskListId', 'taskId', 'updates'],
    },
    handler: updateTask,
  },

  deleteTask: {
    name: 'deleteTask',
    description: 'Delete a task from Google Tasks',
    parameters: {
      type: 'object',
      properties: {
        taskListId: {
          type: 'string',
          description: 'The ID of the task list',
        },
        taskId: {
          type: 'string',
          description: 'The ID of the task to delete',
        },
      },
      required: ['taskListId', 'taskId'],
    },
    handler: deleteTask,
  },
};