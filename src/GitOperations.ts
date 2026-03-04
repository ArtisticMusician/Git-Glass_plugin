import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';

/**
 * Wrapper around simple-git for basic git operations.
 * Provides a clean interface for common git commands.
 */
export class GitOperations {
    private git: SimpleGit;
    private vaultPath: string;

    constructor(vaultPath: string, gitExecutablePath: string = 'git') {
        this.vaultPath = vaultPath;

        const options: Partial<SimpleGitOptions> = {
            baseDir: vaultPath,
            binary: gitExecutablePath,
            maxConcurrentProcesses: 6,
            trimmed: false
        };

        this.git = simpleGit(options);
        console.log(`GitOperations initialized at: ${vaultPath}`);
    }

    async checkIsRepo(): Promise<boolean> {
        return await this.git.checkIsRepo();
    }

    async checkGitAvailable(): Promise<boolean> {
        try {
            await this.git.version();
            return true;
        } catch {
            return false;
        }
    }

    async getStatus() {
        return await this.git.status();
    }

    async getCurrentBranch(): Promise<string> {
        const status = await this.git.status();
        return status.current || 'main';
    }

    async getLastCommitHash(): Promise<string> {
        const log = await this.git.log(['-1']);
        if (log.latest) {
            return log.latest.hash;
        }
        throw new Error('No commits found in repository');
    }

    async stageAll(): Promise<void> {
        await this.git.add('.');
    }

    async commit(message: string) {
        return await this.git.commit(message);
    }

    async pull(remote: string, branch: string, options: string[] = []): Promise<any> {
        return await this.git.pull(remote, branch, options);
    }

    async push(remote: string, branch: string): Promise<void> {
        await this.git.push(remote, branch);
    }

    async stashPush(message: string): Promise<void> {
        await this.git.stash(['push', '-u', '-m', message]);
    }

    async stashPop(): Promise<void> {
        await this.git.stash(['pop']);
    }

    async checkout(args: string[]): Promise<void> {
        await this.git.checkout(args);
    }

    async rebase(args: string[]): Promise<void> {
        await this.git.rebase(args);
    }

    async init(): Promise<void> {
        await this.git.init();
    }

    async checkoutLocalBranch(branch: string): Promise<void> {
        await this.git.checkoutLocalBranch(branch);
    }

    async getRemotes() {
        return await this.git.getRemotes();
    }

    async addRemote(name: string, url: string): Promise<void> {
        await this.git.addRemote(name, url);
    }

    async setRemoteUrl(name: string, url: string): Promise<void> {
        await this.git.remote(['set-url', name, url]);
    }

    async fetch(): Promise<void> {
        await this.git.fetch();
    }

    async addConfig(key: string, value: string): Promise<void> {
        await this.git.addConfig(key, value);
    }

    getVaultPath(): string {
        return this.vaultPath;
    }
}