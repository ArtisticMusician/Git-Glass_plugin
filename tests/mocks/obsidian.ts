// tests/mocks/obsidian.ts

export class Notice {
    constructor(message: string, duration?: number) {
        console.log(`[Notice] ${message}`);
    }
}

export class Platform {
    static isMobile = false;
    static isDesktop = true;
}

export class Plugin {
    app: any;
    manifest: any;
    constructor(app: any, manifest: any) {
        this.app = app;
        this.manifest = manifest;
    }
    static _data: any = {};
    async loadData() { return Plugin._data; }
    async saveData(data: any) { Plugin._data = data; }
    registerInterval(interval: any) { return interval; }
    addCommand(command: any) { }
    addRibbonIcon(icon: string, title: string, callback: any) { return { setIcon: jest.fn() }; }
    addStatusBarItem() { return { setText: jest.fn() }; }
    addSettingTab(tab: any) { }
}

export class PluginSettingTab {
    constructor(app: any, plugin: any) { }
    display() { }
}

export class TFile {
    path: string = '';
    name: string = '';
}

export class FuzzySuggestModal<T> {
    app: any;
    constructor(app: any) { this.app = app; }
    setPlaceholder(text: string) { }
    open() { }
    close() { }
    getItems(): T[] { return []; }
    getItemText(item: T): string { return ''; }
    onChooseItem(item: T, evt: any): void { }
}

export class WorkspaceLeaf {
    openFile(file: any): Promise<void> { return Promise.resolve(); }
}

export class FileSystemAdapter {
    private _basePath: string;
    constructor(basePath: string = '/mock/vault') {
        this._basePath = basePath;
    }
    getBasePath(): string {
        return this._basePath;
    }
}

export const mockAdapter = Object.assign(new FileSystemAdapter('/mock/vault'), {
    read: jest.fn(),
    write: jest.fn(),
    writeBinary: jest.fn(),
    readBinary: jest.fn(),
    stat: jest.fn(),
    mkdir: jest.fn(),
    exists: jest.fn(),
});

export const mockVault = {
    adapter: mockAdapter,
    getFiles: jest.fn(() => []),
};

export const mockApp = {
    vault: mockVault,
};

export function normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
}

export function addIcon(name: string, svg: string): void { }

