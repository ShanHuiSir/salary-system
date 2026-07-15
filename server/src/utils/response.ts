import { Response } from 'express';

/**
 * 统一 API 响应格式
 *
 * { code: 0, message: "success", data: {...} }
 */

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
  requestId?: string;
}

export function success<T>(res: Response, data: T, message = 'success') {
  return res.json({ code: 0, message, data });
}

export function fail(res: Response, code: number, message: string, status = 400) {
  return res.status(status).json({ code, message });
}

export function serverError(res: Response, error: unknown) {
  console.error('[Server Error]', error);
  const message = error instanceof Error ? error.message : '服务器内部错误';
  return res.status(500).json({ code: 5000, message });
}
