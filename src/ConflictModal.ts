import { App, FuzzySuggestModal, TFile, WorkspaceLeaf } from 'obsidian';

export class ConflictResolutionModal extends FuzzySuggestModal<TFile> {
    constructor(app: App) {
        super(app);
        this.setPlaceholder("Select a conflict copy to resolve...");
    }

    getItems(): TFile[] {
        return this.app.vault
            .getFiles()
            .filter(f => f.name.includes('(Conflict - '));
    }

    getItemText(file: TFile): string {
        return file.path;
    }

    async onChooseItem(conflictFile: TFile): Promise<void> {
        const originalPath = this.extractOriginalPath(conflictFile.path);
        const originalFile = this.app.vault.getAbstractFileByPath(originalPath);

        const left = this.app.workspace.getLeaf('split', 'vertical');
        await left.openFile(conflictFile);

        if (originalFile instanceof TFile) {
            const right = this.app.workspace.getRightLeaf(false);
            await right.openFile(originalFile);
        }
    }

    private extractOriginalPath(conflictPath: string): string {
        return conflictPath.replace(/ \(Conflict - [^)]+\)(\.[^.]*)?$/, '$1');
    }
}