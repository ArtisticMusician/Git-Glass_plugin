// tests/GitGlassPlugin.test.ts
import GitGlassPlugin from '../src/main';
import { mockApp, Plugin } from './mocks/obsidian';

jest.mock('../src/SyncManager');

describe('GitGlassPlugin', () => {
    let plugin: GitGlassPlugin;
    let setIntervalSpy: jest.SpyInstance;
    let clearIntervalSpy: jest.SpyInstance;

    beforeEach(() => {
        (Plugin as any)._data = {};
        plugin = new GitGlassPlugin(mockApp as any, {} as any);
        (plugin as any).addCommand = jest.fn();
        (plugin as any).addRibbonIcon = jest.fn();
        setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(jest.fn());
        clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(jest.fn());
    });

    afterEach(() => {
        setIntervalSpy.mockRestore();
        clearIntervalSpy.mockRestore();
    });

    it('should register commands on load', async () => {
        await plugin.onload();
        expect((plugin as any).addCommand).toHaveBeenCalledWith(expect.objectContaining({ id: 'sync-now' }));
        expect((plugin as any).addCommand).toHaveBeenCalledWith(expect.objectContaining({ id: 'init-repo' }));
    });

    it('should register ribbon icon on load', async () => {
        await plugin.onload();
        expect((plugin as any).addRibbonIcon).toHaveBeenCalledWith('git-glass-icon', 'Git Glass Sync', expect.any(Function));
    });

    it('should start auto-sync if enabled', async () => {
        (Plugin as any)._data = { autoSync: true, syncInterval: 1 };

        await plugin.onload();

        expect(setIntervalSpy).toHaveBeenCalled();
    });

    it('should not start auto-sync if disabled', async () => {
        plugin.settings = { autoSync: false } as any;

        await plugin.onload();

        expect(setIntervalSpy).not.toHaveBeenCalled();
    });
});
