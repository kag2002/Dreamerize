export interface ApiSuccessResponse<T> {
  success: true;
  data?: T;
  [key: string]: unknown;
}

export interface ApiErrorResponse {
  success?: false;
  error: string;
  message: string;
  details?: unknown;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
