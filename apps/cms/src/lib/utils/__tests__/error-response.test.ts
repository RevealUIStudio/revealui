/**
 * Integration Tests for Error Response Utilities
 *
 * Tests both Next.js route handler utilities (error-response.ts)
 * and RevealHandler utilities (error-response-handler.ts)
 */

import { ApplicationError, ValidationError } from '@revealui/core/utils/errors';
import { describe, expect, it } from 'vitest';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createSuccessResponse,
  createValidationErrorResponse,
} from '../error-response';
import {
  createApplicationErrorResponse as createHandlerApplicationErrorResponse,
  createErrorResponse as createHandlerErrorResponse,
  createValidationErrorResponse as createHandlerValidationErrorResponse,
} from '../error-response-handler';

describe('Next.js Route Handler Error Utilities (error-response.ts)', () => {
  describe('createErrorResponse', () => {
    it('should handle generic Error objects', async () => {
      const error = new Error('Something went wrong');
      const response = createErrorResponse(error);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('INTERNAL_ERROR');
      // Unknown errors return a generic message (never leak raw error details)
      expect(body.message).toBe('An unexpected error occurred');
    });

    it('should handle ValidationError with context', async () => {
      const error = new ValidationError('Invalid input', 'email', 'not-an-email', {
        field: 'email',
        reason: 'Invalid format',
      });
      const response = createErrorResponse(error);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toBe('Invalid input');
      expect(body.details).toBeDefined();
    });

    it('should handle ApplicationError with custom status', async () => {
      const error = new ApplicationError('Not found', 'NOT_FOUND', 404);
      const response = createErrorResponse(error);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('NOT_FOUND');
      expect(body.message).toBe('Not found');
      expect(body.code).toBe('NOT_FOUND');
    });

    it('should include context in error handling', async () => {
      const error = new Error('Database error');
      const response = createErrorResponse(error, {
        endpoint: '/api/users',
        operation: 'create_user',
      });

      const body = await response.json();
      // Unknown errors return a generic message (never leak raw error details)
      expect(body.message).toBe('An unexpected error occurred');
      expect(body.error).toBe('INTERNAL_ERROR');
    });

    it('should handle unknown error types', async () => {
      const response = createErrorResponse('String error');

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('INTERNAL_ERROR');
      expect(body.message).toBeDefined();
    });
  });

  describe('createValidationErrorResponse', () => {
    it('should create a validation error response', async () => {
      const response = createValidationErrorResponse(
        'Invalid email format',
        'email',
        'not-an-email',
        {
          format: 'expected: email@example.com',
        },
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toBe('Invalid email format');
      expect(body.details).toBeDefined();
    });
  });

  describe('createApplicationErrorResponse', () => {
    it('should create an application error response with custom status', async () => {
      const response = createApplicationErrorResponse('Resource not found', 'NOT_FOUND', 404, {
        resource: 'user',
        id: '123',
      });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('NOT_FOUND');
      expect(body.message).toBe('Resource not found');
      expect(body.code).toBe('NOT_FOUND');
    });

    it('should default to 500 status code', async () => {
      const response = createApplicationErrorResponse('Server error', 'INTERNAL_ERROR');

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('INTERNAL_ERROR');
    });
  });

  describe('createSuccessResponse', () => {
    it('should create a success response with data', async () => {
      const data = { id: '123', name: 'Test' };
      const response = createSuccessResponse(data);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(data);
    });

    it('should allow custom status code', async () => {
      const data = { id: '456' };
      const response = createSuccessResponse(data, 201);

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).toEqual(data);
    });
  });
});

describe('RevealHandler Error Utilities (error-response-handler.ts)', () => {
  describe('createErrorResponse', () => {
    it('should return standard Response (not NextResponse)', async () => {
      const error = new Error('Test error');
      const response = createHandlerErrorResponse(error);

      // Should be a standard Response, not NextResponse
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error).toBe('INTERNAL_ERROR');
      // handleApiError returns 'An error occurred' for generic Error objects
      expect(body.message).toBe('An error occurred');
    });

    it('should have correct Content-Type header', () => {
      const error = new Error('Test');
      const response = createHandlerErrorResponse(error);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('createValidationErrorResponse', () => {
    it('should create validation error with standard Response', async () => {
      const response = createHandlerValidationErrorResponse('Invalid input', 'field', 'value', {
        details: 'test',
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toBe('Invalid input');
    });
  });

  describe('createApplicationErrorResponse', () => {
    it('should create application error with standard Response', async () => {
      const response = createHandlerApplicationErrorResponse('Not authorized', 'UNAUTHORIZED', 401);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('UNAUTHORIZED');
      expect(body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Error response format consistency', () => {
    it('should use the same ErrorResponse interface format', async () => {
      const handlerResponse = createHandlerErrorResponse(new Error('Test'));
      const handlerBody = await handlerResponse.json();

      // Both should have the same structure
      expect(handlerBody).toHaveProperty('error');
      expect(handlerBody).toHaveProperty('message');
      expect(typeof handlerBody.error).toBe('string');
      expect(typeof handlerBody.message).toBe('string');
    });
  });
});
