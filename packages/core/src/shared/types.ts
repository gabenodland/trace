// Generic shared types that are used across modules

export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface User extends BaseEntity {
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export type AsyncFunction<T = any> = (...args: any[]) => Promise<T>;