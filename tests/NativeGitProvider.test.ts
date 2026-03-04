// tests/NativeGitProvider.test.ts
import { NativeGitProvider } from '../src/NativeGitProvider';
import { mockApp, mockVault, mockAdapter } from './mocks/obsidian';
import simpleGit, { SimpleGit } from 'simple-git';

jest.mock('simple-git');

const mockedSimpleGit = {
    checkIsRepo: jest.fn(),
    status: jest.fn(),
    log: jest.fn(),
    add: jest.fn(),
    commit: jest.fn().mockResolvedValue({ commit: 'test-commit-sha' } as any),
    pull: jest.fn(),
    push: jest.fn().mockResolvedValue({} as any),
    rebase: jest.fn().mockResolvedValue({} as any),
    stash: jest.fn(),
    checkout: jest.fn().mockResolvedValue({} as any),
    addConfig: jest.fn().mockResolvedValue({} as any),
    init: jest.fn().mockResolvedValue({} as any),
    checkoutLocalBranch: jest.fn().mockResolvedValue({} as any),
    getRemotes: jest.fn().mockResolvedValue([{ name: 'origin' }]),
    addRemote: jest.fn().mockResolvedValue({} as any),
    remote: jest.fn().mockResolvedValue({} as any),
    fetch: jest.fn().mockResolvedValue({} as any),
    version: jest.fn().mockResolvedValue('1.0.0'),
} as unknown as jest.Mocked<SimpleGit>;

describe('NativeGitProvider', () => {
    let provider: NativeGitProvider;

    beforeEach(() => {
        jest.clearAllMocks();
        (simpleGit as jest.Mock).mockReturnValue(mockedSimpleGit);
        provider = new NativeGitProvider(mockApp as any, 'git', 'https://token@github.com/owner/repo.git');

        // Default mock implementations
        mockedSimpleGit.checkIsRepo.mockResolvedValue(true);
        mockedSimpleGit.status.mockResolvedValue({ files: [], current: 'main', ahead: 0, behind: 0, conflicted: [] } as any);
        mockedSimpleGit.log.mockResolvedValue({ latest: { hash: 'test-hash' } } as any);
    });

    describe('push', () => {
        it('should commit and push changes', async () => {
            mockedSimpleGit.status.mockResolvedValueOnce({ files: [{ path: 'test.md' }], current: 'main' } as any);
            mockedSimpleGit.pull.mockResolvedValue({} as any);

            await provider.push();

            expect(mockedSimpleGit.add).toHaveBeenCalledWith('.');
            expect(mockedSimpleGit.commit).toHaveBeenCalled();
            expect(mockedSimpleGit.pull).toHaveBeenCalledWith('origin', 'main', ['--rebase']);
            expect(mockedSimpleGit.push).toHaveBeenCalledWith('origin', 'main');
        });

        it('should handle merge conflicts during pull --rebase', async () => {
            mockedSimpleGit.status.mockResolvedValue({ files: [{ path: 'test.md' }], conflicted: ['test.md'], current: 'main' } as any);
            mockedSimpleGit.pull.mockRejectedValue(new Error('conflict'));
            mockAdapter.read.mockResolvedValue('<<<<<<< HEAD\nlocal\n=======\nremote\n>>>>>>> branch-a');

            await provider.push();

            expect(mockAdapter.write).toHaveBeenCalledWith(expect.stringContaining('Conflict'), expect.any(String));
            expect(mockedSimpleGit.checkout).toHaveBeenCalledWith(['--ours', 'test.md']);
            expect(mockedSimpleGit.add).toHaveBeenCalledWith('.');
            expect(mockedSimpleGit.rebase).toHaveBeenCalledWith(['--continue']);
        });
    });

    describe('pull', () => {
        it('should stash, pull, and pop changes', async () => {
            mockedSimpleGit.status.mockResolvedValueOnce({ files: [{ path: 'local_change.md' }], conflicted: [] } as any);
            mockedSimpleGit.pull.mockResolvedValue({} as any);
            (mockedSimpleGit.stash as jest.Mock).mockResolvedValue('');

            await provider.pull();

            expect(mockedSimpleGit.stash).toHaveBeenCalledWith(['push', '-u', '-m', 'Git Glass auto-stash before pull']);
            expect(mockedSimpleGit.pull).toHaveBeenCalled();
            expect(mockedSimpleGit.stash).toHaveBeenCalledWith(['pop']);
        });

        it('should handle conflicts when popping stash', async () => {
            mockedSimpleGit.status.mockResolvedValue({ files: [{ path: 'local_change.md' }], conflicted: ['local_change.md'], current: 'main' } as any);
            mockedSimpleGit.pull.mockResolvedValue({} as any);
            (mockedSimpleGit.stash as jest.Mock).mockResolvedValueOnce('stash_hash');
            (mockedSimpleGit.stash as jest.Mock).mockRejectedValueOnce(new Error('conflict'));
            mockAdapter.read.mockResolvedValue('<<<<<<< HEAD\nlocal\n=======\nremote\n>>>>>>> branch-a');

            await provider.pull();

            expect(mockAdapter.write).toHaveBeenCalledWith(expect.stringContaining('Conflict'), expect.any(String));
        });
    });

    describe('full cycle', () => {
        it('should handle a pull-conflict-push cycle', async () => {
            // 1. Initial state: one local change
            mockedSimpleGit.status.mockResolvedValueOnce({ files: [{ path: 'local.md' }], conflicted: [] } as any);

            // 2. Pull with a conflict
            mockedSimpleGit.pull.mockResolvedValueOnce({ files: ['remote.md'], summary: { changes: 1 } } as any);
            (mockedSimpleGit.stash as jest.Mock).mockResolvedValueOnce('stash_hash');
            (mockedSimpleGit.stash as jest.Mock).mockRejectedValueOnce(new Error('conflict'));
            mockedSimpleGit.status.mockResolvedValueOnce({ files: [{ path: 'remote.md' }], conflicted: [], current: 'main' } as any); // getCurrentBranch call
            mockedSimpleGit.status.mockResolvedValueOnce({ conflicted: ['remote.md'], files: [] } as any); // statusAfterPop
            mockAdapter.read.mockResolvedValue('<<<<<<< HEAD\nlocal\n=======\nremote\n>>>>>>> branch-a');

            await provider.pull();

            // 4. Then we push
            mockedSimpleGit.status.mockResolvedValueOnce({ files: [{ path: 'local.md' }] } as any);
            mockedSimpleGit.pull.mockResolvedValue({} as any);
            await provider.push();

            expect(mockAdapter.write).toHaveBeenCalledWith(expect.stringContaining('Conflict'), expect.any(String));
            expect(mockedSimpleGit.commit).toHaveBeenCalled();
            expect(mockedSimpleGit.push).toHaveBeenCalled();
        });
    });
});
