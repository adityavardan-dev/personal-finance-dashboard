/**
 * Purpose: Defines and validates conversation and request IDs used to trace one turn.
 */
import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export interface RequestTrace {
  conversationId: string;
  requestId: string;
}

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Returns read request trace. */
export function readRequestTrace(
  conversationId?: string,
  requestId?: string,
): RequestTrace {
  if (conversationId && !UUID_V4.test(conversationId)) {
    throw new BadRequestException('Invalid conversation ID.');
  }
  if (requestId && !UUID_V4.test(requestId)) {
    throw new BadRequestException('Invalid request ID.');
  }
  return {
    conversationId: conversationId ?? randomUUID(),
    requestId: requestId ?? randomUUID(),
  };
}
