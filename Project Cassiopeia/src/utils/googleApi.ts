import { useAuth } from '../auth/AuthContext';

// Google API utility functions
export class GoogleApiService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  // Calendar API methods
  async getCalendarEvents(timeMin?: string, timeMax?: string) {
    try {
      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('singleEvents', 'true');
      
      if (timeMin) url.searchParams.set('timeMin', timeMin);
      if (timeMax) url.searchParams.set('timeMax', timeMax);

      console.log('Fetching calendar events from:', url.toString());

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Calendar API error response:', errorText);
        throw new Error(`Calendar API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Calendar API success:', data);
      return data;
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  }

  async createCalendarEvent(event: any) {
    try {
      console.log('Creating calendar event:', event);

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Calendar creation error response:', errorText);
        throw new Error(`Calendar API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Calendar event created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }

  // Gmail API methods
  async sendEmail(to: string, subject: string, body: string) {
    try {
      const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        '',
        body
      ].join('\n');

      const encodedEmail = btoa(email).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      console.log('Sending email to:', to, 'with subject:', subject);

      const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encodedEmail,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gmail send error response:', errorText);
        throw new Error(`Gmail API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Email sent successfully:', data);
      return data;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async getEmails(maxResults: number = 10, query?: string) {
    try {
      const url = new URL('https://www.googleapis.com/gmail/v1/users/me/messages');
      url.searchParams.set('maxResults', maxResults.toString());
      
      if (query) {
        url.searchParams.set('q', query);
      }

      console.log('Fetching emails from:', url.toString());

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gmail list error response:', errorText);
        throw new Error(`Gmail API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Gmail list success:', data);
      return data;
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw error;
    }
  }

  async getEmailDetails(messageId: string) {
    try {
      console.log('Fetching email details for:', messageId);

      const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gmail details error response:', errorText);
        throw new Error(`Gmail API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Gmail details success for', messageId);
      return data;
    } catch (error) {
      console.error('Error fetching email details:', error);
      throw error;
    }
  }

  // Google Sheets API methods
  async getSheetValues(spreadsheetId: string, range: string) {
    try {
      console.log('Fetching sheet values:', { spreadsheetId, range });

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Sheets API error response:', errorText);
        throw new Error(`Sheets API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Sheets API success:', data);
      return data;
    } catch (error) {
      console.error('Error fetching sheet values:', error);
      throw error;
    }
  }

  async updateSheetValues(spreadsheetId: string, range: string, values: any[][]) {
    try {
      console.log('Updating sheet values:', { spreadsheetId, range, values });

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: values,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Sheets update error response:', errorText);
        throw new Error(`Sheets API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Sheets update success:', data);
      return data;
    } catch (error) {
      console.error('Error updating sheet values:', error);
      throw error;
    }
  }

  async createSpreadsheet(title: string) {
    try {
      console.log('Creating spreadsheet:', title);

      const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            title: title,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Sheets creation error response:', errorText);
        throw new Error(`Sheets API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Spreadsheet created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error creating spreadsheet:', error);
      throw error;
    }
  }

  // Google Docs API methods
  async createDocument(title: string) {
    try {
      console.log('Creating document:', title);

      const response = await fetch('https://docs.googleapis.com/v1/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Docs creation error response:', errorText);
        throw new Error(`Docs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Document created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }

  async getDocumentContent(documentId: string) {
    try {
      console.log('Fetching document content:', documentId);

      const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Docs API error response:', errorText);
        throw new Error(`Docs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Document content fetched successfully');
      return data;
    } catch (error) {
      console.error('Error fetching document content:', error);
      throw error;
    }
  }

  async updateDocumentContent(documentId: string, requests: any[]) {
    try {
      console.log('Updating document content:', { documentId, requests });

      const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: requests,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Docs update error response:', errorText);
        throw new Error(`Docs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Document updated successfully:', data);
      return data;
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  }

  // Google Drive API methods
  async searchDriveFiles(query: string, maxResults: number = 10) {
    try {
      console.log('Searching Drive files:', { query, maxResults });

      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('q', query);
      url.searchParams.set('pageSize', maxResults.toString());
      url.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,webViewLink,size)');

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Drive API error response:', errorText);
        throw new Error(`Drive API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Drive search success:', data);
      return data;
    } catch (error) {
      console.error('Error searching Drive files:', error);
      throw error;
    }
  }

  async getDriveFileContent(fileId: string) {
    try {
      console.log('Fetching Drive file content:', fileId);

      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Drive file content error response:', errorText);
        throw new Error(`Drive API error: ${response.status} - ${errorText}`);
      }

      const content = await response.text();
      console.log('Drive file content fetched successfully');
      return content;
    } catch (error) {
      console.error('Error fetching Drive file content:', error);
      throw error;
    }
  }

  // Google Meet API methods
  async createMeetSpace(displayName?: string) {
    try {
      console.log('Creating Meet space:', displayName);

      const response = await fetch('https://meet.googleapis.com/v2/spaces', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            entryPointAccess: 'ALL',
            accessType: 'OPEN'
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Meet API error response:', errorText);
        throw new Error(`Meet API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Meet space created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error creating Meet space:', error);
      throw error;
    }
  }

  async getMeetSpace(spaceId: string) {
    try {
      console.log('Fetching Meet space:', spaceId);

      const response = await fetch(`https://meet.googleapis.com/v2/spaces/${spaceId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Meet API error response:', errorText);
        throw new Error(`Meet API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Meet space fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('Error fetching Meet space:', error);
      throw error;
    }
  }

  // Google Tasks API methods
  async getTaskLists() {
    try {
      console.log('Fetching task lists');

      const response = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Tasks API error response:', errorText);
        throw new Error(`Tasks API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Task lists fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('Error fetching task lists:', error);
      throw error;
    }
  }

  async getTasks(taskListId: string, maxResults: number = 100) {
    try {
      console.log('Fetching tasks from list:', taskListId);

      const url = new URL(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`);
      url.searchParams.set('maxResults', maxResults.toString());

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Tasks API error response:', errorText);
        throw new Error(`Tasks API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Tasks fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  }

  async createTask(taskListId: string, title: string, notes?: string, due?: string) {
    try {
      console.log('Creating task:', { taskListId, title, notes, due });

      const taskData: any = {
        title: title,
      };

      if (notes) {
        taskData.notes = notes;
      }

      if (due) {
        taskData.due = due;
      }

      const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Tasks API error response:', errorText);
        throw new Error(`Tasks API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Task created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  async updateTask(taskListId: string, taskId: string, updates: any) {
    try {
      console.log('Updating task:', { taskListId, taskId, updates });

      const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Tasks API error response:', errorText);
        throw new Error(`Tasks API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Task updated successfully:', data);
      return data;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  async deleteTask(taskListId: string, taskId: string) {
    try {
      console.log('Deleting task:', { taskListId, taskId });

      const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Tasks API error response:', errorText);
        throw new Error(`Tasks API error: ${response.status} - ${errorText}`);
      }

      console.log('Task deleted successfully');
      return { success: true };
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  // Helper method to extract email body from Gmail API response
  extractEmailBody(payload: any): string {
    if (!payload) return '';

    // If the email has parts, iterate through them
    if (payload.parts && payload.parts.length > 0) {
      for (const part of payload.parts) {
        // Look for text/plain content
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return this.decodeBase64Url(part.body.data);
        }
        
        // If it's multipart, recursively search
        if (part.parts) {
          const bodyFromParts = this.extractEmailBody(part);
          if (bodyFromParts) return bodyFromParts;
        }
      }
      
      // Fallback to text/html if no plain text found
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          const htmlContent = this.decodeBase64Url(part.body.data);
          // Basic HTML to text conversion (remove tags)
          return htmlContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        }
      }
    }
    
    // If no parts, check if body data is directly available
    if (payload.body?.data) {
      return this.decodeBase64Url(payload.body.data);
    }
    
    return '';
  }

  // Helper method to decode base64url encoded data
  private decodeBase64Url(data: string): string {
    try {
      // Convert base64url to base64
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
      // Decode and return
      return atob(padded);
    } catch (error) {
      console.error('Error decoding base64url:', error);
      return '';
    }
  }

  // Helper method to extract text content from Google Docs
  extractDocumentText(document: any): string {
    if (!document.body || !document.body.content) return '';

    let text = '';
    
    const extractFromContent = (content: any[]): string => {
      let result = '';
      
      for (const element of content) {
        if (element.paragraph) {
          if (element.paragraph.elements) {
            for (const elem of element.paragraph.elements) {
              if (elem.textRun && elem.textRun.content) {
                result += elem.textRun.content;
              }
            }
          }
        } else if (element.table) {
          // Handle tables
          if (element.table.tableRows) {
            for (const row of element.table.tableRows) {
              if (row.tableCells) {
                for (const cell of row.tableCells) {
                  if (cell.content) {
                    result += extractFromContent(cell.content) + '\t';
                  }
                }
                result += '\n';
              }
            }
          }
        }
      }
      
      return result;
    };

    text = extractFromContent(document.body.content);
    return text.trim();
  }
}

// Hook to get Google API service instance
export function useGoogleApi() {
  const { user } = useAuth();
  
  if (!user?.accessToken || user.accessToken === 'demo_token') {
    return null;
  }

  return new GoogleApiService(user.accessToken);
}