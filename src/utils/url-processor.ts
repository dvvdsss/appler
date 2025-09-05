/**
 * URL processing utility for Apple Developer documentation
 * Handles URL validation, normalization, and malformed URL detection
 * Adapted from batch processing to single URL processing for fetch operations
 */

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl: string;
  error?: string;
}

/**
 * Convert youtu.be short URLs to youtube.com format for database compatibility
 */
export function convertYouTubeShortUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Check if it's a youtu.be URL
    if (parsed.hostname.toLowerCase() === "youtu.be") {
      // Extract video ID from pathname (remove leading slash)
      const videoId = parsed.pathname.slice(1);

      if (videoId) {
        // Convert to youtube.com format
        let convertedUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // Preserve any additional query parameters
        if (parsed.search) {
          // Remove the leading '?' and append with '&'
          convertedUrl += `&${parsed.search.slice(1)}`;
        }

        return convertedUrl;
      }
    }

    // Return original URL if not a youtu.be URL or invalid format
    return url;
  } catch {
    // Return original URL if parsing fails
    return url;
  }
}

/**
 * Validates and normalizes a single URL using elegant malformed URL detection
 * Integrates the sophisticated filtering logic for comprehensive validation
 */
export function validateAndNormalizeUrl(url: string): UrlValidationResult {
  // Basic validation
  if (!url || typeof url !== "string" || url.trim().length === 0) {
    return {
      isValid: false,
      normalizedUrl: url,
      error: "URL is required",
    };
  }

  // Apply malformed URL detection - global optimal solution
  const isValidUrl = ![
    url.split("https://").length > 2 || url.split("http://").length > 2, // Duplicate protocol
    url.includes("%ef%bb%bf") || url.includes("\ufeff"), // BOM characters
    url.split("/documentation/").length > 2, // Path duplication
    url.includes("https:/") && !url.startsWith("https://"), // Protocol format error
    url.length > 200, // Abnormal length
    url.split("developer.apple.com").length > 2, // Duplicate domain
  ].some(Boolean);

  if (!isValidUrl) {
    return {
      isValid: false,
      normalizedUrl: url,
      error: "URL contains malformed patterns",
    };
  }

  // Clean and normalize URL - elegant, modern, and concise
  try {
    const parsed = new URL(url);
    // Preserve case sensitivity for Apple Developer paths
    const normalizedPath =
      parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, ""); // Remove trailing slashes except root

    // Special handling for YouTube URLs - preserve query parameters
    const isYouTubeUrl = parsed.hostname.toLowerCase().includes("youtube.com");

    let normalizedUrl: string;
    if (isYouTubeUrl) {
      // For YouTube URLs, preserve query parameters (especially ?v= parameter)
      normalizedUrl = `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${normalizedPath}${parsed.search}`;
    } else {
      // For other URLs, remove query parameters and fragments to match pages table format
      normalizedUrl = `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${normalizedPath}`;
    }

    return {
      isValid: true,
      normalizedUrl,
    };
  } catch {
    return {
      isValid: false,
      normalizedUrl: url,
      error: "Invalid URL format",
    };
  }
}
