export interface PublicFeedback {
  id: string;
  rating: number;
  suggestion: string | null;
  bugReport: string | null;
  createdAt: number;
  authorEmail: string | null;
  isPublic: boolean;
  isOwner: boolean;
  upvotes: number;
  hasUpvoted: boolean;
}

export interface CharacterComment {
  id: string;
  body: string;
  createdAt: number;
  updatedAt: number | null;
  authorEmail: string | null;
  isOwner: boolean;
  isDeleted: boolean;
  replyCount: number;
}

export interface CommunityPage<T> {
  items: T[];
  nextCursor: string | null;
}

export class CommunityApiError extends Error {
  constructor(readonly status: number) {
    super(`Community request failed: ${status}`);
  }
}

export async function loadCommunityPage<T>(
  path: string,
  cursor: string | null,
  signal: AbortSignal,
  includeOwn = false
): Promise<CommunityPage<T>> {
  const params = new URLSearchParams({ game: "GI" });
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`${path}?${params}`, {
    signal,
    credentials: includeOwn ? "same-origin" : "omit",
  });
  if (!response.ok) throw new CommunityApiError(response.status);
  return response.json();
}

export async function postCharacterComment(
  characterId: string,
  body: string,
  parentId?: string
): Promise<void> {
  const response = await fetch(
    `/api/community/v1/characters/${encodeURIComponent(characterId)}/comments${parentId ? `/${encodeURIComponent(parentId)}/replies` : ""}?game=GI`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }
  );
  if (!response.ok) throw new CommunityApiError(response.status);
}

export async function updateCharacterComment(
  characterId: string,
  id: string,
  body: string | null
): Promise<void> {
  const response = await fetch(
    `/api/community/v1/characters/${encodeURIComponent(characterId)}/comments/${encodeURIComponent(id)}?game=GI`,
    {
      method: body === null ? "DELETE" : "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...(body === null ? {} : { body: JSON.stringify({ body }) }),
    }
  );
  if (!response.ok) throw new CommunityApiError(response.status);
}
