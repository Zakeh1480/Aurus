export const profileQueryKey = ["users", "me", "profile"] as const;
export const consentsQueryKey = ["users", "me", "consents"] as const;
export const consentStatusQueryKey = ["users", "me", "consents", "status"] as const;

export const rankingListBaseQueryKey = ["ranking", "list"] as const;
export const rankingListQueryKey = (limit: number) => [...rankingListBaseQueryKey, limit] as const;
export const rankingMeQueryKey = ["ranking", "me"] as const;

export const moderationReportsBaseQueryKey = ["moderation", "reports"] as const;
export const moderationReportsQueryKey = (status?: string) => [...moderationReportsBaseQueryKey, status ?? "all"] as const;
export const moderationReportDetailQueryKey = (id: string) => ["moderation", "reports", id] as const;
