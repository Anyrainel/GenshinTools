/**
 * Cloudflare Pages Function: CORS Proxy for Enka.Network API
 *
 * This function acts as a proxy to bypass CORS restrictions when fetching
 * player data from Enka.Network. It runs on Cloudflare's edge network.
 *
 * Route: /api/enka/* -> https://enka.network/api/*
 * Example: /api/enka/uid/123456789 -> https://enka.network/api/uid/123456789
 */

const ENKA_BASE_URL = "https://enka.network/api";

// CORS headers to allow requests from any origin
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400", // 24 hours preflight cache
};

type Env = Record<string, never>;

export const onRequest: PagesFunction<Env, "path"> = async (context) => {
  const { request, params } = context;

  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only allow GET requests
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  // Build the target URL path from the catch-all param
  const pathSegments = params.path;
  const targetPath = Array.isArray(pathSegments)
    ? pathSegments.join("/")
    : pathSegments || "";

  const targetUrl = `${ENKA_BASE_URL}/${targetPath}`;

  try {
    // Forward the request to Enka.Network
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "GenshinTools/1.0 (https://ggartifact.com)",
        Accept: "application/json",
      },
    });

    // Get the response body
    const body = await response.text();

    // Return the proxied response with CORS headers
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...CORS_HEADERS,
        "Content-Type":
          response.headers.get("Content-Type") || "application/json",
        // Preserve cache headers from Enka if present
        ...(response.headers.get("Cache-Control") && {
          "Cache-Control": response.headers.get("Cache-Control")!,
        }),
      },
    });
  } catch (error) {
    console.error("Enka proxy error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch from Enka.Network" }),
      {
        status: 502,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
        },
      }
    );
  }
};
