/**
 * Rating helper functions for converting between stars (1-5) and decimal (0-10) scales
 *
 * Storage: All ratings are stored as decimal 0-10 (with one decimal place precision)
 * Display: Based on stream configuration:
 * - stars: 1-5 stars
 * - decimal_whole: 0-10 whole numbers only
 * - decimal: 0.0-10.0 with tenths precision
 */

export type RatingType = 'stars' | 'decimal_whole' | 'decimal';

/**
 * Convert star selection (1-5) to storage value (0-10)
 * 1 star = 2, 2 stars = 4, etc.
 */
export function starsToDecimal(stars: number): number {
  if (stars <= 0) return 0;
  if (stars > 5) return 10;
  return stars * 2;
}

/**
 * Convert storage value (0-10) to star display (1-5)
 * Uses threshold mapping:
 * - 0.1 - 2.5 → 1 star
 * - 2.6 - 4.5 → 2 stars
 * - 4.6 - 6.5 → 3 stars
 * - 6.6 - 8.5 → 4 stars
 * - 8.6 - 10.0 → 5 stars
 */
export function decimalToStars(decimal: number): number {
  if (decimal <= 0) return 0;
  if (decimal <= 2.5) return 1;
  if (decimal <= 4.5) return 2;
  if (decimal <= 6.5) return 3;
  if (decimal <= 8.5) return 4;
  return 5;
}

/**
 * Format rating for display based on rating type
 * @param rating - The stored rating value (0-10 scale)
 * @param ratingType - 'stars', 'decimal_whole', or 'decimal'
 * @returns Formatted string for display
 */
export function formatRatingDisplay(rating: number, ratingType: RatingType = 'stars'): string {
  if (rating <= 0) return '';

  if (ratingType === 'decimal') {
    // Show as X.X/10 with tenths
    return `${rating.toFixed(1)}/10`;
  }

  if (ratingType === 'decimal_whole') {
    // Show as X/10 (whole numbers)
    return `${Math.round(rating)}/10`;
  }

  // Stars mode - show as X/5
  const stars = decimalToStars(rating);
  return `${stars}/5`;
}

/**
 * Format rating with star icons for display
 * @param rating - The stored rating value (0-10 scale)
 * @param ratingType - 'stars', 'decimal_whole', or 'decimal'
 * @returns Formatted string with stars or decimal
 */
export function formatRatingWithIcon(rating: number, ratingType: RatingType = 'stars'): string {
  if (rating <= 0) return '';

  if (ratingType === 'decimal') {
    return `★ ${rating.toFixed(1)}`;
  }

  if (ratingType === 'decimal_whole') {
    return `★ ${Math.round(rating)}`;
  }

  // Stars mode - show filled stars
  const starCount = decimalToStars(rating);
  return '★'.repeat(starCount);
}

/**
 * Validate and clamp a decimal rating value
 * Ensures value is between 0 and 10 with max 1 decimal place
 */
export function clampRating(value: number): number {
  if (value < 0) return 0;
  if (value > 10) return 10;
  // Round to 1 decimal place
  return Math.round(value * 10) / 10;
}

/**
 * Check if a rating value is valid (greater than 0)
 */
export function hasRating(rating: number): boolean {
  return rating > 0;
}

/**
 * Get the minimum valid rating value
 * For decimal mode: 0.1
 * For decimal_whole mode: 1
 * For stars mode: 2 (1 star)
 */
export function getMinRating(ratingType: RatingType = 'stars'): number {
  if (ratingType === 'decimal') return 0.1;
  if (ratingType === 'decimal_whole') return 1;
  return 2; // stars
}

/**
 * Get display label for rating type
 */
export function getRatingTypeLabel(ratingType: RatingType): string {
  switch (ratingType) {
    case 'stars': return 'Stars (1-5)';
    case 'decimal_whole': return '10-Base (0-10)';
    case 'decimal': return '10-Base with Decimals';
    default: return 'Stars (1-5)';
  }
}
