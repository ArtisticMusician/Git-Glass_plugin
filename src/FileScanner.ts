import { App, TFile } from 'obsidian';
import { FileExclusionRules } from './FileExclusionRules';

export interface FileChange {
    path: string;
    data: Uint8Array;
    mode: '100644' | '100755' | '040000';
    type: 'blob' | 'tree';
    sha?: string;
}

export class FileScanner {
    static async detectChanges(
        app: App,
        fileHashes: Record<string, string>,
        lastSyncTime?: number
    ): Promise<FileChange[]> {
        const changes: FileChange[] = [];
        const files = app.vault.getFiles();

        for (const file of files) {
            if (FileExclusionRules.shouldExclude(file.path)) continue;
            if (lastSyncTime && file.stat.mtime <= lastSyncTime) continue;

            const content = await app.vault.adapter.readBinary(file.path);
            const currentHash = await this.calculateSha(content);

            if (fileHashes[file.path] !== currentHash) {
                changes.push({
                    path: file.path,
                    data: new Uint8Array(content),
                    mode: '100644',
                    type: 'blob'
                });
            }
        }

        return changes;
    }

    static async calculateSha(data: ArrayBuffer): Promise<string> {
        const bytes = new Uint8Array(data);
        const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
        const blob = new Uint8Array(header.length + bytes.length);

        blob.set(header);
        blob.set(bytes, header.length);

        const hashBuffer = await crypto.subtle.digest('SHA-1', blob);

        return Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }
}