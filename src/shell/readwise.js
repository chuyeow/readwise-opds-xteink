const API = "https://readwise.io/api/v3/list/";

export class ReadwiseError extends Error {
  constructor(status, retryAfter) {
    super(`Readwise API responded ${status}`);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function createReadwiseClient({ token, fetch }) {
  async function list(params) {
    const response = await fetch(`${API}?${new URLSearchParams(params)}`, {
      headers: { Authorization: `Token ${token}` }
    });
    if (!response.ok) throw new ReadwiseError(response.status, response.headers.get("retry-after"));
    return response.json();
  }

  return {
    async listLocation({ location, cursor, limit }) {
      const params = { location, limit: String(limit) };
      if (cursor) params.pageCursor = cursor;
      const page = await list(params);
      return { docs: page.results, nextCursor: page.nextPageCursor };
    },

    async getDocument(id) {
      const page = await list({ id, withHtmlContent: "true" });
      return page.results[0] ?? null;
    }
  };
}
