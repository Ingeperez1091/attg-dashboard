import { handlers } from "@/auth";
import { appBootTrace, runWithTraceContext } from "@/lib/runtime-trace";

import { type NextRequest } from "next/server";

const { GET: _GET, POST: _POST } = handlers;

function getOrCreateRequestId(existing?: string | null): string {
	if (existing && existing.trim()) {
		return existing.trim();
	}

	return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCanonicalOrigin(request: NextRequest): string {
	const configured = process.env.AUTH_URL?.trim();
	if (configured) {
		try {
			return new URL(configured).origin;
		} catch {
			// Fall through to request-derived origin.
		}
	}

	const origin = request.nextUrl.origin;
	if (origin.includes("0.0.0.0")) {
		return "http://localhost";
	}

	return origin;
}

function getNormalizedAuthRequest(request: NextRequest, normalizedPath: string): NextRequest {
	const url = new URL(request.url);
	const normalizedUrl = new URL(normalizedPath + url.search, getCanonicalOrigin(request));

	// NextRequest.url is read-only; use a proxy so Auth.js reads normalized values
	// while preserving all original NextRequest behavior.
	const normalizedNextUrl = normalizedUrl as unknown as NextRequest["nextUrl"];
	const proxied = new Proxy(request as object, {
		get(target, prop, receiver) {
			if (prop === "url") {
				return normalizedUrl.toString();
			}

			if (prop === "nextUrl") {
				return normalizedNextUrl;
			}

			const value = Reflect.get(target, prop, receiver);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});

	return proxied as NextRequest;
}

function getNormalizedAuthPath(pathname: string): string | null {
	const guidPrefixed = pathname.match(/^\/[0-9a-fA-F-]{36}(\/api\/auth\/.*)$/);
	if (guidPrefixed) {
		return guidPrefixed[1];
	}

	const pipeGuidPrefixed = pathname.match(/^\/\/pipe\/[0-9a-fA-F-]{36}(\/api\/auth\/.*)$/);
	if (pipeGuidPrefixed) {
		return pipeGuidPrefixed[1];
	}

	return null;
}

export async function GET(request: NextRequest) {
	const url = new URL(request.url);
	const normalizedPath = getNormalizedAuthPath(url.pathname);
	const requestId = getOrCreateRequestId(request.headers.get("x-request-id"));

	return runWithTraceContext({ requestId }, async () => {
		appBootTrace("auth-route:get:start", {
			requestId,
			url: request.url,
			pathname: url.pathname,
			normalizedPath,
			hasCode: url.searchParams.has("code"),
			hasState: url.searchParams.has("state"),
			host: request.headers.get("host"),
			xForwardedHost: request.headers.get("x-forwarded-host"),
			xForwardedProto: request.headers.get("x-forwarded-proto")
		});

		try {
			const response = normalizedPath
				? await _GET(getNormalizedAuthRequest(request, normalizedPath))
				: await _GET(request);

			appBootTrace("auth-route:get:finish", {
				requestId,
				pathname: url.pathname,
				normalizedPath,
				status: response.status,
				location: response.headers.get("location")
			});

			return response;
		} catch (error) {
			appBootTrace("auth-route:get:error", {
				requestId,
				pathname: url.pathname,
				normalizedPath,
				message: error instanceof Error ? error.message : String(error)
			});
			throw error;
		}
	});
}

export async function POST(request: NextRequest) {
	const url = new URL(request.url);
	const normalizedPath = getNormalizedAuthPath(url.pathname);
	const requestId = getOrCreateRequestId(request.headers.get("x-request-id"));

	return runWithTraceContext({ requestId }, async () => {
		appBootTrace("auth-route:post:start", {
			requestId,
			url: request.url,
			pathname: url.pathname,
			normalizedPath,
			host: request.headers.get("host"),
			xForwardedHost: request.headers.get("x-forwarded-host"),
			xForwardedProto: request.headers.get("x-forwarded-proto")
		});

		try {
			const response = normalizedPath
				? await _POST(getNormalizedAuthRequest(request, normalizedPath))
				: await _POST(request);

			appBootTrace("auth-route:post:finish", {
				requestId,
				pathname: url.pathname,
				normalizedPath,
				status: response.status,
				location: response.headers.get("location")
			});

			return response;
		} catch (error) {
			appBootTrace("auth-route:post:error", {
				requestId,
				pathname: url.pathname,
				normalizedPath,
				message: error instanceof Error ? error.message : String(error)
			});
			throw error;
		}
	});
}