import { App, Platform } from 'obsidian';
import { SyncProvider } from './SyncProviderInterface';
import { GitHubApiProvider } from './GitHubApiProvider';
import { GitGlassSettings } from './SettingsInterface';

export class SyncManager {
    private app: App;
    private settings: GitGlassSettings;
    private syncProvider: SyncProvider | null = null;
    private isSyncing: boolean = false;

    private onNotice: (message: string) => void;

    constructor(app: App, settings: GitGlassSettings, onNotice: (message: string) => void) {
        this.app = app;
        this.settings = settings;
        this.onNotice = onNotice;
    }

    private parseGitHubUrl(url: string): { owner: string; repo: string } {
        const match = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
        if (!match) {
            throw new Error(`Cannot parse GitHub URL: ${url}`);
        }
        return { owner: match[1], repo: match[2] };
    }

    private buildAuthenticatedUrl(): string {
        const { remoteUrl, githubToken } = this.settings;
        if (!githubToken || !remoteUrl) return remoteUrl;
        return remoteUrl.replace(/^https:\/\//, `https://${githubToken}@`);
    }

    async initialize(): Promise<void> {
        if (Platform.isMobile) {
            await this.initializeMobileProvider();
        } else {
            await this.initializeDesktopProvider();
        }
    }

    private async initializeMobileProvider(): Promise<void> {
        if (!this.settings.githubToken) {
            this.onNotice('Git Glass: Please enter your GitHub Personal Access Token in settings.');
            return;
        }
        if (!this.settings.remoteUrl) {
            this.onNotice('Git Glass: Please enter your Repository URL in settings.');
            return;
        }

        let owner: string;
        let repo: string;
        try {
            ({ owner, repo } = this.parseGitHubUrl(this.settings.remoteUrl));
        } catch {
            this.onNotice('Git Glass: Repository URL is invalid. Use: https://github.com/username/repo.git');
            return;
        }

        this.syncProvider = new GitHubApiProvider(
            this.app,
            this.settings.githubToken,
            owner,
            repo,
            this.settings.branch,
            (msg) => this.onNotice(msg)
        );
    }

    private async initializeDesktopProvider(): Promise<void> {
        if (this.settings.useNativeGit === false) {
            await this.initializeMobileProvider();
            return;
        }

        const { NativeGitProvider } = await import('./NativeGitProvider');
        const nativeProvider = new NativeGitProvider(
            this.app,
            this.settings.gitExecutablePath,
            this.buildAuthenticatedUrl(),
            (msg) => this.onNotice(msg)
        );

        this.syncProvider = nativeProvider;

        const gitAvailable = await nativeProvider.checkGitAvailable();
        if (!gitAvailable) {
            this.onNotice('Git Glass: Git executable not found. Please check your git path in settings.');
            console.error('Git executable not found at:', this.settings.gitExecutablePath);
            return;
        }

        console.log('Initialized Native Git Provider for desktop');
    }

    async performSync(): Promise<boolean> {
        if (this.isSyncing) {
            this.onNotice('Sync already in progress...');
            return false;
        }

        if (!this.syncProvider) {
            this.onNotice('Git Glass: Still connecting to your Repo. Please wait a moment.');
            return false;
        }

        this.isSyncing = true;

        try {
            await this.syncProvider.pull();
            await this.syncProvider.push();

            this.onNotice('Git Glass: Sync Operation Successful!');
            return true;
        } catch (error) {
            console.error('Sync error:', error);
            this.onNotice(`Git Glass Error: ${error.message}`);
            return false;
        } finally {
            this.isSyncing = false;
        }
    }

    async initializeRepository(branch?: string): Promise<void> {
        if (Platform.isMobile) {
            this.onNotice('Git Glass: Initial setup is currently optimized for desktop. (Working on a fix!)');
            return;
        }
        try {
            const { NativeGitProvider } = await import('./NativeGitProvider');
            const nativeProvider = new NativeGitProvider(this.app, this.settings.gitExecutablePath, this.buildAuthenticatedUrl());
            await nativeProvider.initializeRepository(
                this.buildAuthenticatedUrl(),
                branch || this.settings.branch
            );
            this.onNotice('Git Glass: Repository Initialization Successful!');
        } catch (error) {
            this.onNotice(`Git Glass: Failed to initialize repository - ${error.message}`);
        }
    }

    async getStatus(): Promise<string> {
        if (Platform.isMobile) {
            return 'Status only available on desktop';
        }

        try {
            const { NativeGitProvider } = await import('./NativeGitProvider');
            const nativeProvider = new NativeGitProvider(this.app, this.settings.gitExecutablePath);
            return await nativeProvider.getStatus();
        } catch (error) {
            return `Error: ${error.message}`;
        }
    }

    isCurrentlySyncing(): boolean {
        return this.isSyncing;
    }
}
