import { App, Notice, normalizePath } from 'obsidian';
import { PathUtils } from './PathUtils';

export class ConflictResolver {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    async checkForConflict(path: string, lastSyncTime: number): Promise<boolean> {
        try {
            const stat = await this.app.vault.adapter.stat(path);
            if (!stat) return false;

            return stat.mtime > lastSyncTime;
        } catch {
            return false;
        }
    }

    async createConflictCopy(path: string, content: string | Uint8Array): Promise<string> {
        const conflictPath = PathUtils.generateConflictPath(path);
        const normalized = normalizePath(conflictPath);

        await this.ensureDirectory(normalized);

        if (content instanceof Uint8Array) {
            await this.app.vault.adapter.writeBinary(normalized, content);
        } else {
            await this.app.vault.adapter.write(normalized, content);
        }

        new Notice(`Conflict: Created ${conflictPath}`);
        return conflictPath;
    }

    async ensureDirectory(path: string): Promise<void> {
        const dir = PathUtils.getDirectory(path);
        if (!dir) return;

        const segments = dir.split('/');
        let currentPath = '';

        for (const segment of segments) {
            currentPath = currentPath === '' ? segment : `${currentPath}/${segment}`;
            try {
                await this.app.vault.adapter.stat(currentPath);
            } catch {
                await this.app.vault.adapter.mkdir(currentPath);
            }
        }
    }
}