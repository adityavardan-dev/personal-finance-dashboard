export interface RequestTrace {
  conversationId: string;
  requestId: string;
}

export function requestTraceHeaders(trace?: RequestTrace): Record<string, string> {
  return trace
    ? {
        'X-Conversation-Id': trace.conversationId,
        'X-Request-Id': trace.requestId,
      }
    : {};
}
