export interface SyncProvider {
    push(): Promise<void>;
    pull(): Promise<void>;
    getLastCommitSha(): Promise<string>;
}

export interface SyncState {
    lastSyncSha: string;
    lastSyncTime: number;
    fileHashes?: Record<string, string>; // Optional: used by mobile provider
}