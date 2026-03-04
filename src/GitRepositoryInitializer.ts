import { App, normalizePath, Notice, FileSystemAdapter } from 'obsidian';
import { GitOperations } from './GitOperations';
import { FileExclusionRules } from './FileExclusionRules';

export class GitRepositoryInitializer {
    private app: App;
    private git: GitOperations;
    private vaultPath: string;

    constructor(app: App, gitExecutablePath: string) {
        this.app = app;

        if (!(app.vault.adapter instanceof FileSystemAdapter)) {
            throw new Error('Git repository initialization is only supported on desktop.');
        }

        this.vaultPath = app.vault.adapter.getBasePath();
        this.git = new GitOperations(this.vaultPath, gitExecutablePath);
    }

    async initialize(remoteUrl: string, branch: string = 'main'): Promise<void> {
        const isRepo = await this.git.checkIsRepo();

        if (!isRepo) {
            await this.git.init();
            await this.git.checkoutLocalBranch(branch);
        }

        // Disable credential helper so GCM doesn't intercept token-based auth
        await this.git.addConfig('credential.helper', '');

        const remotes = await this.git.getRemotes();
        if (remotes.some(r => r.name === 'origin')) {
            await this.git.setRemoteUrl('origin', remoteUrl);
        } else {
            await this.git.addRemote('origin', remoteUrl);
        }

        await this.ensureGitignore();

        if (!isRepo) {
            await this.git.stageAll();
            await this.git.commit('Initial commit by Git Glass');
        }

        new Notice('Git Glass: Repository initialized.');
    }

    private async ensureGitignore(): Promise<void> {
        const ignorePath = normalizePath('.gitignore');
        const defaultIgnore = FileExclusionRules.generateGitignore();

        let existing = '';
        if (await this.app.vault.adapter.exists(ignorePath)) {
            existing = await this.app.vault.adapter.read(ignorePath);
        }

        const missing = defaultIgnore
            .split('\n')
            .filter(line => line.trim() !== '' && !existing.includes(line));

        if (missing.length > 0) {
            const updated =
                existing +
                (existing.endsWith('\n') ? '' : '\n') +
                missing.join('\n') +
                '\n';

            await this.app.vault.adapter.write(ignorePath, updated);
        }
    }
}