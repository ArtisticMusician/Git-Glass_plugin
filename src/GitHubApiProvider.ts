import { App, normalizePath } from 'obsidian';
import { GitHubClient } from './GitHubClient';
import { FileScanner } from './FileScanner';
import { StateManager } from './StateManager';
import { ConflictResolver } from './ConflictResolver';
import { FileExclusionRules } from './FileExclusionRules';
import { GitGlassError } from './Errors';

export class GitHubApiProvider {
    private client: GitHubClient;
    private stateManager: StateManager;
    private conflictResolver: ConflictResolver;
    private app: App;
    private onNotice: (message: string) => void;

    constructor(
        app: App,
        token: string,
        owner: string,
        repo: string,
        branch: string,
        onNotice?: (message: string) => void
    ) {
        this.app = app;
        this.onNotice = onNotice || ((msg) => console.log(`Notice: ${msg}`));
        this.client = new GitHubClient(token, owner, repo, branch);
        this.stateManager = new StateManager(app);
        this.conflictResolver = new ConflictResolver(app);
    }

    async push(): Promise<void> {
        console.log('GitHubApiProvider: Starting push...');
        try {
            const state = await this.stateManager.load();
            const changes = await FileScanner.detectChanges(this.app, state.fileHashes, state.lastSyncTime);

            if (changes.length === 0) {
                console.log('No changes to push');
                return;
            }

            console.log(`Detected ${changes.length} file changes`);

            const remoteSha = await this.client.getLastCommitSha();
            const tree = await this.client.createTree(remoteSha || '', changes);
            console.log(`Created tree: ${tree.sha}`);

            const commit = await this.client.createCommit(
                tree.sha,
                remoteSha,
                `Git Glass Sync [${new Date().toISOString()}]`
            );
            console.log(`Created commit: ${commit.sha}`);

            await this.client.updateRef(commit.sha);
            console.log(`Updated branch to ${commit.sha}`);

            await this.stateManager.update({
                lastSyncSha: commit.sha,
                lastSyncTime: Date.now(),
                fileHashes: await this.getCurrentFileHashes()
            });

            console.log('Push completed successfully');
        } catch (error) {
            if (error instanceof GitGlassError) throw error;
            throw new GitGlassError('SYNC_FAILED', `Push failed: ${error.message}`);
        }
    }

    async pull(): Promise<void> {
        console.log('GitHubApiProvider: Starting pull...');
        try {
            const remoteSha = await this.client.getLastCommitSha();
            const state = await this.stateManager.load();

            if (!remoteSha || state.lastSyncSha === remoteSha) {
                console.log('Already up to date');
                return;
            }

            const tree = await this.client.getRemoteTree(remoteSha);

            let downloadCount = 0;
            let conflictCount = 0;

            for (const item of tree.tree) {
                if (item.type !== 'blob' || !item.path || FileExclusionRules.shouldExclude(item.path)) {
                    continue;
                }

                const normalizedPath = normalizePath(item.path);
                if (state.fileHashes[normalizedPath] === item.sha) {
                    continue;
                }

                const content = await this.client.getFileContent(item.path, remoteSha);
                if (content === null) continue;

                const hasConflict = await this.conflictResolver.checkForConflict(normalizedPath, state.lastSyncTime);

                if (hasConflict) {
                    await this.conflictResolver.createConflictCopy(normalizedPath, content);
                    conflictCount++;
                } else {
                    await this.conflictResolver.ensureDirectory(normalizedPath);
                    await this.app.vault.adapter.write(normalizedPath, content);
                    downloadCount++;
                }
            }

            await this.stateManager.update({
                lastSyncSha: remoteSha,
                lastSyncTime: Date.now(),
                fileHashes: await this.getCurrentFileHashes()
            });

            console.log(`Pull completed: ${downloadCount} files updated, ${conflictCount} conflicts`);

            if (conflictCount > 0) {
                this.onNotice(`Git Glass: ${conflictCount} conflict(s) detected. Check for Conflict copies.`);
            }
        } catch (error) {
            if (error instanceof GitGlassError) throw error;
            throw new GitGlassError('SYNC_FAILED', `Pull failed: ${error.message}`);
        }
    }

    async getLastCommitSha(): Promise<string> {
        return (await this.client.getLastCommitSha()) || '';
    }

    private async getCurrentFileHashes(): Promise<Record<string, string>> {
        const hashes: Record<string, string> = {};
        const files = this.app.vault.getFiles();

        for (const file of files) {
            if (FileExclusionRules.shouldExclude(file.path)) continue;
            const data = await this.app.vault.adapter.readBinary(file.path);
            hashes[file.path] = await FileScanner.calculateSha(data);
        }

        return hashes;
    }
}
