// tests/SyncManager.test.ts
import { SyncManager } from '../src/SyncManager';
import { GitHubApiProvider } from '../src/GitHubApiProvider';
import { NativeGitProvider } from '../src/NativeGitProvider';
import { mockApp } from './mocks/obsidian';
import { Platform } from 'obsidian';

jest.mock('../src/GitHubApiProvider');
jest.mock('../src/NativeGitProvider', () => {
    return {
        NativeGitProvider: jest.fn().mockImplementation(() => {
            return {
                pull: jest.fn(),
                push: jest.fn(),
                checkGitAvailable: jest.fn().mockResolvedValue(true),
            };
        }),
    };
});

describe('SyncManager', () => {
    let syncManager: SyncManager;
    const settings = {
        githubToken: 'test_token',
        remoteUrl: 'https://github.com/test_owner/test_repo.git',
        branch: 'main',
        // ... other settings
    } as any;

    beforeEach(() => {
        jest.clearAllMocks();
        syncManager = new SyncManager(mockApp as any, settings, jest.fn());
    });

    it('should initialize GitHubApiProvider on mobile', async () => {
        Platform.isMobile = true;
        await syncManager.initialize();
        expect(GitHubApiProvider).toHaveBeenCalled();
    });

    it('should initialize NativeGitProvider on desktop', async () => {
        Platform.isMobile = false;
        await syncManager.initialize();
        expect(NativeGitProvider).toHaveBeenCalled();
    });

    it('should not call push if pull fails', async () => {
        Platform.isMobile = false;
        await syncManager.initialize();

        const mockProvider = (syncManager as any).syncProvider;
        mockProvider.pull.mockRejectedValue(new Error('Pull failed'));

        await syncManager.performSync();

        expect(mockProvider.pull).toHaveBeenCalled();
        expect(mockProvider.push).not.toHaveBeenCalled();
    });

    it('should call both pull and push on successful sync', async () => {
        Platform.isMobile = false;
        await syncManager.initialize();

        const mockProvider = (syncManager as any).syncProvider;
        mockProvider.pull.mockResolvedValue(undefined);
        mockProvider.push.mockResolvedValue(undefined);

        await syncManager.performSync();

        expect(mockProvider.pull).toHaveBeenCalled();
        expect(mockProvider.push).toHaveBeenCalled();
    });
});
