export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		switch (url.pathname) {
			case "/api/check": {
				if (request.method !== "POST") {
					return Response.json(
						{ status: "error", message: "Method Not Allowed" },
						{ status: 405 }
					);
				}

				let data: { id?: string };

				try {
					data = await request.json();
				} catch {
					return Response.json(
						{ status: "error", message: "Invalid JSON" },
						{ status: 400 }
					);
				}

				if (!data.id || typeof data.id !== "string") {
					return Response.json(
						{ status: "error", message: "Missing id" },
						{ status: 400 }
					);
				}

				const cache = caches.default;

				const cacheKey = new Request(
					`https://worker-cache.example/api/check?id=${encodeURIComponent(data.id)}`
				);

				const cached = await cache.match(cacheKey);

				if (cached) {
					return cached;
				}

				try {
					const apiUrl = new URL(
						"https://uploaderjp-full-archive.activetk.jp/api/list"
					);

					apiUrl.searchParams.set("q", data.id);
					apiUrl.searchParams.set("sort", "size");
					apiUrl.searchParams.set("state", "");
					apiUrl.searchParams.set("page", "1");

					const response = await fetch(apiUrl.toString());

					if (!response.ok) {
						return Response.json(
							{ status: "error", message: "External API Error" },
							{ status: 502 }
						);
					}

					const result = await response.json() as {
						items?: unknown[];
					};

					if (!result.items || result.items.length === 0) {
						return Response.json({
							status: "not_found",
							item: null
						});
					}

					const output = Response.json({
						status: "ok",
						item: result.items[0]
					});

					const cachedResponse = new Response(output.body, output);
					cachedResponse.headers.set(
						"Cache-Control",
						"public, max-age=30"
					);

					ctx.waitUntil(
						cache.put(cacheKey, cachedResponse.clone())
					);

					return cachedResponse;

				} catch (error) {
					console.error("API Error:", error);

					return Response.json(
						{ status: "error", message: "Internal Server Error" },
						{ status: 500 }
					);
				}
			}

			default:
				return new Response("Not Found", { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;