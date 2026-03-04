// tests/GitHubApiProvider.test.ts
import { GitHubApiProvider } from '../src/GitHubApiProvider';
import { GitHubClient } from '../src/GitHubClient';
import { StateManager } from '../src/StateManager';
import { mockApp, mockAdapter, mockVault } from './mocks/obsidian';

jest.mock('../src/GitHubClient');
jest.mock('../src/StateManager');

const mockClient = {
    getLastCommitSha: jest.fn(),
    getRemoteTree: jest.fn(),
    createTree: jest.fn(),
    createCommit: jest.fn(),
    updateRef: jest.fn(),
    getFileContent: jest.fn(),
};

const mockState = {
    load: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
};

// Define global.self for crypto in test environment
if (typeof self === 'undefined') {
    (global as any).self = global;
}
const nodeCrypto = require('crypto');
if (!(global.self as any).crypto) {
    Object.defineProperty(global.self, 'crypto', {
        value: {
            subtle: {
                digest: (algorithm: string, data: Uint8Array) =>
                    new Promise(resolve =>
                        resolve(nodeCrypto.createHash('sha1').update(data).digest())
                    )
            }
        }
    });
}

describe('GitHubApiProvider', () => {
    let provider: GitHubApiProvider;

    beforeEach(() => {
        jest.clearAllMocks();

        (GitHubClient as jest.MockedClass<typeof GitHubClient>).mockImplementation(() => mockClient as any);
        (StateManager as jest.MockedClass<typeof StateManager>).mockImplementation(() => mockState as any);

        mockState.load.mockResolvedValue({ lastSyncSha: '', lastSyncTime: 0, fileHashes: {}, pendingConflicts: [] });
        mockState.update.mockResolvedValue(undefined);
        mockAdapter.readBinary.mockResolvedValue(new ArrayBuffer(0));
        mockVault.getFiles.mockReturnValue([]);

        provider = new GitHubApiProvider(mockApp as any, 'test_token', 'test_owner', 'test_repo', 'main');
    });

    describe('push', () => {
        it('should push detected changes', async () => {
            const fileData = new TextEncoder().encode('test content').buffer;
            mockVault.getFiles.mockReturnValue([{ path: 'test.md', stat: { mtime: Date.now() } }] as any);
            mockAdapter.readBinary.mockResolvedValue(fileData);
            mockState.load.mockResolvedValue({ lastSyncSha: '', lastSyncTime: 0, fileHashes: {}, pendingConflicts: [] });

            mockClient.getLastCommitSha.mockResolvedValue('base_sha');
            mockClient.createTree.mockResolvedValue({ sha: 'tree_sha' });
            mockClient.createCommit.mockResolvedValue({ sha: 'commit_sha' });

            await provider.push();

            expect(mockClient.createTree).toHaveBeenCalled();
            expect(mockClient.createCommit).toHaveBeenCalled();
            expect(mockClient.updateRef).toHaveBeenCalled();
        });

        it('should handle the first commit (null remote sha)', async () => {
            const fileData = new TextEncoder().encode('test content').buffer;
            mockVault.getFiles.mockReturnValue([{ path: 'test.md', stat: { mtime: Date.now() } }] as any);
            mockAdapter.readBinary.mockResolvedValue(fileData);

            mockClient.getLastCommitSha.mockResolvedValue(null);
            mockClient.createTree.mockResolvedValue({ sha: 'tree_sha' });
            mockClient.createCommit.mockResolvedValue({ sha: 'commit_sha' });

            await provider.push();

            expect(mockClient.createCommit).toHaveBeenCalledWith('tree_sha', null, expect.any(String));
            expect(mockClient.updateRef).toHaveBeenCalled();
        });

        it('should do nothing when there are no changes', async () => {
            mockVault.getFiles.mockReturnValue([]);

            await provider.push();

            expect(mockClient.createTree).not.toHaveBeenCalled();
        });
    });

    describe('pull', () => {
        it('should download and update files', async () => {
            mockClient.getLastCommitSha.mockResolvedValue('remote_sha');
            mockClient.getRemoteTree.mockResolvedValue({
                tree: [{ path: 'test.md', type: 'blob', sha: 'blob_sha' }]
            });
            mockClient.getFileContent.mockResolvedValue('remote content');
            mockAdapter.stat.mockResolvedValue(null); // no local file = no conflict

            await provider.pull();

            expect(mockAdapter.write).toHaveBeenCalledWith('test.md', 'remote content');
        });

        it('should create conflict copies for modified files', async () => {
            mockClient.getLastCommitSha.mockResolvedValue('remote_sha');
            mockClient.getRemoteTree.mockResolvedValue({
                tree: [{ path: 'test.md', type: 'blob', sha: 'blob_sha' }]
            });
            mockClient.getFileContent.mockResolvedValue('remote content');
            mockAdapter.stat.mockResolvedValue({ mtime: Date.now() }); // local file recently modified

            await provider.pull();

            expect(mockAdapter.write).toHaveBeenCalledWith(expect.stringContaining('Conflict'), 'remote content');
        });

        it('should skip when already up to date', async () => {
            mockClient.getLastCommitSha.mockResolvedValue('same_sha');
            mockState.load.mockResolvedValue({ lastSyncSha: 'same_sha', lastSyncTime: 0, fileHashes: {}, pendingConflicts: [] });

            await provider.pull();

            expect(mockClient.getRemoteTree).not.toHaveBeenCalled();
        });
    });
});
