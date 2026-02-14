/**
 * ToastService - Simple cross-screen toast messaging
 *
 * Allows one screen to queue a toast message that another screen
 * will display. Uses event-based subscription for persistent screens.
 */

type ToastListener = (message: string) => void;

const listeners: Set<ToastListener> = new Set();

/**
 * Subscribe to toast events
 * Returns unsubscribe function
 */
export function subscribeToToast(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Emit a toast message to all subscribers
 */
export function emitToast(message: string): void {
  listeners.forEach(listener => listener(message));
}
