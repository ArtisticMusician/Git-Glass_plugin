import { App } from 'obsidian';

export interface SyncState {
    lastSyncSha: string;
    lastSyncTime: number;
    fileHashes: Record<string, string>;
    pendingConflicts: string[];
}

export class StateManager {
    private app: App;
    private stateFilePath = '.obsidian/git-glass-state.json';

    constructor(app: App) {
        this.app = app;
    }

    async load(): Promise<SyncState> {
        try {
            const raw = await this.app.vault.adapter.read(this.stateFilePath);
            return JSON.parse(raw) as SyncState;
        } catch {
            return {
                lastSyncSha: '',
                lastSyncTime: 0,
                fileHashes: {},
                pendingConflicts: []
            };
        }
    }

    async save(state: SyncState): Promise<void> {
        await this.app.vault.adapter.write(
            this.stateFilePath,
            JSON.stringify(state, null, 2)
        );
    }

    async update(partial: Partial<SyncState>): Promise<void> {
        const current = await this.load();
        const updated = { ...current, ...partial };
        await this.save(updated);
    }

    async clearConflicts(): Promise<void> {
        const state = await this.load();
        state.pendingConflicts = [];
        await this.save(state);
    }
}