import { App, FileSystemAdapter } from 'obsidian';
import { GitOperations } from './GitOperations';
import { GitConflictHandler } from './GitConflictHandler';
import { GitRepositoryInitializer } from './GitRepositoryInitializer';
import { StateManager } from './StateManager';
import { FileExclusionRules } from './FileExclusionRules';
import { GitGlassError } from './Errors';

export class NativeGitProvider {
    private git: GitOperations;
    private conflictHandler: GitConflictHandler;
    private stateManager: StateManager;
    private app: App;
    private gitExecutablePath: string;
    private remoteUrl: string;
    private onNotice: (message: string) => void;

    constructor(app: App, gitExecutablePath: string = 'git', remoteUrl: string = '', onNotice?: (message: string) => void) {
        this.app = app;
        this.gitExecutablePath = gitExecutablePath;
        this.remoteUrl = remoteUrl;
        this.onNotice = onNotice || ((msg) => console.log(`Notice: ${msg}`));

        if (!(app.vault.adapter instanceof FileSystemAdapter)) {
            throw new GitGlassError('REPO_NOT_INITIALIZED', 'NativeGitProvider requires a desktop filesystem.');
        }

        const vaultPath = app.vault.adapter.getBasePath();
        this.git = new GitOperations(vaultPath, gitExecutablePath);
        this.conflictHandler = new GitConflictHandler(app, this.git);
        this.stateManager = new StateManager(app);
    }

    private async ensureRemote(): Promise<void> {
        if (!this.remoteUrl) return;
        await this.git.addConfig('credential.helper', '');
        const remotes = await this.git.getRemotes();
        if (remotes.some(r => r.name === 'origin')) {
            await this.git.setRemoteUrl('origin', this.remoteUrl);
        } else {
            await this.git.addRemote('origin', this.remoteUrl);
        }
    }

    async push(): Promise<void> {
        try {
            console.log('NativeGitProvider: Starting push...');

            if (!await this.git.checkIsRepo()) {
                throw new GitGlassError('REPO_NOT_INITIALIZED', 'Not a git repository. Please initialize git first.');
            }

            await this.ensureRemote();

            const status = await this.git.getStatus();
            const changedFiles = status.files.filter(f => !FileExclusionRules.shouldExclude(f.path));

            if (changedFiles.length === 0) {
                console.log('No changes to commit');
                return;
            }

            console.log(`Detected ${changedFiles.length} file changes`);

            await this.git.stageAll();
            console.log('Staged changes');

            const commitMessage = `Git Glass Sync [${new Date().toISOString()}]`;
            const commitResult = await this.git.commit(commitMessage);
            console.log(`Created commit: ${commitResult.commit}`);

            const currentBranch = await this.git.getCurrentBranch();
            try {
                await this.git.pull('origin', currentBranch, ['--rebase']);
                console.log('Pulled with rebase successfully');
            } catch (pullError) {
                const pullErrorMsg = pullError.message || String(pullError);
                if (pullErrorMsg.includes('unrelated histories')) {
                    await this.git.pull('origin', currentBranch, ['--allow-unrelated-histories']);
                } else if (
                    pullErrorMsg.includes("couldn't find remote ref") ||
                    pullErrorMsg.includes('does not match any')
                ) {
                    console.log('Skipping pull: remote branch does not exist yet.');
                } else {
                    const statusAfterPull = await this.git.getStatus();
                    if (statusAfterPull.conflicted.length > 0) {
                        await this.conflictHandler.handleMergeConflicts(statusAfterPull.conflicted);
                        await this.git.rebase(['--continue']);
                        this.onNotice(`Git Glass: ${statusAfterPull.conflicted.length} conflict(s) resolved. Check for Conflict copies.`);
                    } else {
                        throw pullError;
                    }
                }
            }

            await this.git.push('origin', currentBranch);
            console.log('Pushed to remote successfully');

            const currentSha = await this.git.getLastCommitHash();
            await this.stateManager.update({ lastSyncSha: currentSha, lastSyncTime: Date.now() });

            console.log('Push completed successfully');
        } catch (error) {
            if (error instanceof GitGlassError) throw error;
            throw new GitGlassError('SYNC_FAILED', `Push failed: ${error.message}`);
        }
    }

    async pull(): Promise<void> {
        try {
            console.log('NativeGitProvider: Starting pull...');

            if (!await this.git.checkIsRepo()) {
                throw new GitGlassError('REPO_NOT_INITIALIZED', 'Not a git repository. Please initialize git first.');
            }

            await this.ensureRemote();

            const status = await this.git.getStatus();
            const preExistingConflicts = status.conflicted ?? [];

            // If the index already has unresolved conflicts (e.g. from a previous failed sync),
            // resolve them first — otherwise git stash will fail with "could not write index".
            if (preExistingConflicts.length > 0) {
                console.log(`Resolving ${preExistingConflicts.length} pre-existing conflict(s) before pull...`);
                await this.conflictHandler.handleMergeConflicts(preExistingConflicts);
                await this.git.commit(`Git Glass: Resolved pre-existing conflicts [${new Date().toISOString()}]`);
                this.onNotice(`Git Glass: ${preExistingConflicts.length} pre-existing conflict(s) resolved. Check for Conflict copies.`);
            }

            // Exclude already-resolved conflicted files from the stash check
            const hasLocalChanges = status.files
                .filter(f => !FileExclusionRules.shouldExclude(f.path) && !preExistingConflicts.includes(f.path))
                .length > 0;

            if (hasLocalChanges) {
                console.log('Stashing local changes...');
                await this.git.stashPush('Git Glass auto-stash before pull');
            }

            const currentBranch = await this.git.getCurrentBranch();
            try {
                await this.git.pull('origin', currentBranch);
            } catch (pullError) {
                const errorMsg = pullError.message || String(pullError);
                if (
                    errorMsg.includes("couldn't find remote ref") ||
                    errorMsg.includes('initial commit') ||
                    errorMsg.includes('not currently on a branch') ||
                    errorMsg.includes('does not match any')
                ) {
                    console.log('Skipping pull: remote branch does not exist or repo is empty.');
                } else if (errorMsg.includes('unrelated histories')) {
                    try {
                        await this.git.pull('origin', currentBranch, ['--allow-unrelated-histories']);
                    } catch (mergeError) {
                        const mergeStatus = await this.git.getStatus();
                        if (mergeStatus.conflicted.length > 0) {
                            await this.conflictHandler.handleMergeConflicts(mergeStatus.conflicted);
                            await this.git.commit(`Git Glass: Resolved merge conflicts [${new Date().toISOString()}]`);
                            this.onNotice(`Git Glass: ${mergeStatus.conflicted.length} conflict(s) resolved. Check for Conflict copies.`);
                        } else {
                            throw mergeError;
                        }
                    }
                } else {
                    // Pull may have left the index in a conflicted state
                    const conflictStatus = await this.git.getStatus();
                    if (conflictStatus.conflicted.length > 0) {
                        await this.conflictHandler.handleMergeConflicts(conflictStatus.conflicted);
                        await this.git.commit(`Git Glass: Resolved merge conflicts [${new Date().toISOString()}]`);
                        this.onNotice(`Git Glass: ${conflictStatus.conflicted.length} conflict(s) resolved. Check for Conflict copies.`);
                    } else {
                        throw pullError;
                    }
                }
            }

            if (hasLocalChanges) {
                try {
                    console.log('Applying stashed changes...');
                    await this.git.stashPop();
                } catch (stashError) {
                    const statusAfterPop = await this.git.getStatus();
                    if (statusAfterPop.conflicted.length > 0) {
                        await this.conflictHandler.handleMergeConflicts(statusAfterPop.conflicted);
                        this.onNotice(`Git Glass: ${statusAfterPop.conflicted.length} conflict(s) resolved from stash. Check for Conflict copies.`);
                    } else {
                        throw stashError;
                    }
                }
            }

            const currentSha = await this.git.getLastCommitHash();
            await this.stateManager.update({ lastSyncSha: currentSha, lastSyncTime: Date.now() });

            console.log('Pull completed successfully');
        } catch (error) {
            if (error instanceof GitGlassError) throw error;
            throw new GitGlassError('SYNC_FAILED', `Pull failed: ${error.message}`);
        }
    }

    async getLastCommitSha(): Promise<string> {
        return await this.git.getLastCommitHash();
    }

    async initializeRepository(remoteUrl: string, branch: string = 'main'): Promise<void> {
        const initializer = new GitRepositoryInitializer(this.app, this.gitExecutablePath);
        await initializer.initialize(remoteUrl, branch);
    }

    async checkGitAvailable(): Promise<boolean> {
        return await this.git.checkGitAvailable();
    }

    async getStatus(): Promise<string> {
        try {
            if (!await this.git.checkIsRepo()) {
                return 'Not a git repository';
            }

            await this.ensureRemote();

            try {
                await this.git.fetch();
            } catch (fetchError) {
                return `Remote unreachable: ${fetchError.message}`;
            }

            const status = await this.git.getStatus();
            const parts: string[] = [];

            if (status.ahead > 0) parts.push(`${status.ahead} commits ahead`);
            if (status.behind > 0) parts.push(`${status.behind} commits behind`);
            if (status.files.length > 0) parts.push(`${status.files.length} changes`);

            return parts.length > 0 ? parts.join(', ') : 'Up to date';
        } catch (error) {
            return `Error: ${error.message}`;
        }
    }
}
