// tests/Logic.test.ts
import { PathUtils } from '../src/PathUtils';
import { FileScanner } from '../src/FileScanner';
import { ConflictResolver } from '../src/ConflictResolver';
import { FileExclusionRules } from '../src/FileExclusionRules';
import { GitGlassError, withRetry } from '../src/Errors';
import { mockApp, mockVault, mockAdapter } from './mocks/obsidian';

// Define global.self for the test environment
if (typeof self === 'undefined') {
    (global as any).self = global;
}

const crypto = require('crypto');
Object.defineProperty(global.self, 'crypto', {
    value: {
        subtle: {
            digest: (algorithm: string, data: Uint8Array) => {
                return new Promise(resolve =>
                    resolve(crypto.createHash('sha1').update(data).digest())
                );
            }
        }
    }
});

describe('PathUtils', () => {
    it('should create a conflict path for a file with an extension', () => {
        const filePath = 'path/to/file.md';
        const conflictPath = PathUtils.generateConflictPath(filePath);
        expect(conflictPath).toMatch(/path\/to\/file \(Conflict - .*\)\.md/);
    });

    it('should create a conflict path for a file without an extension', () => {
        const filePath = 'path/to/file';
        const conflictPath = PathUtils.generateConflictPath(filePath);
        expect(conflictPath).toMatch(/path\/to\/file \(Conflict - .*\)/);
    });
});

describe('FileScanner', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should calculate the correct SHA-1 hash for a string', async () => {
        const content = 'hello world';
        const expectedSha = '95d09f2b10159347eece71399a7e2e907ea3df4f';
        const data = new TextEncoder().encode(content).buffer;
        const sha = await FileScanner.calculateSha(data);
        expect(sha).toBe(expectedSha);
    });

    it('should detect new and modified files and skip unchanged files based on mtime', async () => {
        const lastSyncTime = Date.now() - 10000;
        const files = [
            { path: 'new.md', content: 'new content', mtime: Date.now() },
            { path: 'modified.md', content: 'new modified content', mtime: Date.now() },
            { path: 'unchanged.md', content: 'unchanged content', mtime: lastSyncTime - 1000 },
        ];

        const encode = (s: string) => new TextEncoder().encode(s).buffer;
        const fileHashes = {
            'modified.md': await FileScanner.calculateSha(encode('old modified content')),
            'unchanged.md': await FileScanner.calculateSha(encode('unchanged content')),
        };

        mockVault.getFiles.mockReturnValue(files.map(f => ({
            path: f.path,
            stat: { mtime: f.mtime }
        } as any)));
        mockAdapter.readBinary.mockImplementation(async (path: string) => {
            const content = files.find(f => f.path === path)?.content || '';
            return new TextEncoder().encode(content).buffer;
        });

        const changes = await FileScanner.detectChanges(mockApp as any, fileHashes, lastSyncTime);

        expect(changes.length).toBe(2);
        expect(changes.map(c => c.path)).toContain('new.md');
        expect(changes.map(c => c.path)).toContain('modified.md');
    });
});

describe('ConflictResolver', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should detect a conflict if file was modified after last sync', async () => {
        const lastSyncTime = Date.now() - 10000;
        const mtime = Date.now();

        mockAdapter.stat.mockResolvedValue({ mtime });

        const resolver = new ConflictResolver(mockApp as any);
        const hasConflict = await resolver.checkForConflict('file.md', lastSyncTime);
        expect(hasConflict).toBe(true);
    });

    it('should not detect a conflict if file was modified before last sync', async () => {
        const lastSyncTime = Date.now();
        const mtime = Date.now() - 10000;

        mockAdapter.stat.mockResolvedValue({ mtime });

        const resolver = new ConflictResolver(mockApp as any);
        const hasConflict = await resolver.checkForConflict('file.md', lastSyncTime);
        expect(hasConflict).toBe(false);
    });
});

describe('FileExclusionRules', () => {
    it('should exclude files in excluded directories', () => {
        expect(FileExclusionRules.shouldExclude('.git/config')).toBe(true);
    });

    it('should exclude specific files', () => {
        expect(FileExclusionRules.shouldExclude('.obsidian/workspace.json')).toBe(true);
    });

    it('should not exclude other files', () => {
        expect(FileExclusionRules.shouldExclude('file.md')).toBe(false);
    });
});

describe('Errors', () => {
    it('should create a GitGlassError with a code', () => {
        const error = new GitGlassError('test_code', 'test error');
        expect(error.message).toBe('test error');
        expect(error.code).toBe('test_code');
    });

    it('should retry a function that fails', async () => {
        const fn = jest.fn()
            .mockRejectedValueOnce(new Error('fail'))
            .mockResolvedValueOnce('success');

        const result = await withRetry(fn, 2, 0);
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw the last error after all retries fail', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('fail'));
        await expect(withRetry(fn, 3, 0)).rejects.toThrow('fail');
        expect(fn).toHaveBeenCalledTimes(3);
    });
});
