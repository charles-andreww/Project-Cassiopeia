export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'gemma';
  timestamp: Date;
  functionCall?: FunctionCall;
  plan?: ExecutionPlan;
  imageUrl?: string;
  videoUrl?: string;
  videoData?: {
    mimeType: string;
    data: string;
  };
}

export interface FunctionCall {
  name: string;
  arguments: Record<string, any>;
  result?: string;
  displayContent?: string | React.ReactNode;
}

export interface MessageProcessorResponse {
  content: string;
  functionCall?: FunctionCall;
}

export interface FunctionResult {
  rawResult: string;
  displayContent: string | React.ReactNode;
}
