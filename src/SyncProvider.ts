export interface RemoteFile {
    path: string;
    sha: string;
    size: number;
}

export interface SyncProvider {
    getLatestCommitSha(): Promise<string>;
    listRemoteFiles(): Promise<RemoteFile[]>;
    downloadFile(path: string): Promise<string | Uint8Array>;
    uploadFile(path: string, content: string | Uint8Array): Promise<void>;
    deleteFile(path: string): Promise<void>;
}