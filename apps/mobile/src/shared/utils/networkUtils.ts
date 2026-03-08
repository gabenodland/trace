/**
 * Check if an error is a network connectivity failure.
 * Matches the TypeError thrown by fetch() when the device is offline.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Network request failed') {
    return true;
  }
  if (error instanceof Error && error.message === 'Network request failed') {
    return true;
  }
  return false;
}
