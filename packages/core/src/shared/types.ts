// Generic shared types that are used across modules

export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export type AsyncFunction<T = any> = (...args: any[]) => Promise<T>;