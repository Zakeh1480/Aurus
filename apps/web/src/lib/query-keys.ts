export const profileQueryKey = ["users", "me", "profile"] as const;
export const consentsQueryKey = ["users", "me", "consents"] as const;
export const consentStatusQueryKey = ["users", "me", "consents", "status"] as const;

export const rankingListBaseQueryKey = ["ranking", "list"] as const;
export const rankingListQueryKey = (limit: number) => [...rankingListBaseQueryKey, limit] as const;
export const rankingMeQueryKey = ["ranking", "me"] as const;
