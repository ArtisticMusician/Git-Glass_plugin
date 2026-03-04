import { App, Notice, normalizePath } from 'obsidian';
import { GitOperations } from './GitOperations';
import { PathUtils } from './PathUtils';

/**
 * Handles merge conflicts for desktop git operations.
 * Creates conflict copies and resolves conflicts by choosing the local version.
 */
export class GitConflictHandler {
    private app: App;
    private gitOps: GitOperations;

    constructor(app: App, gitOps: GitOperations) {
        this.app = app;
        this.gitOps = gitOps;
    }

    async handleMergeConflicts(conflictedFiles: string[]): Promise<void> {
        console.log(`Handling ${conflictedFiles.length} merge conflicts`);

        for (const filePath of conflictedFiles) {
            try {
                await this.resolveConflict(filePath);
            } catch (error) {
                console.error(`Failed to handle conflict for ${filePath}:`, error);

                await this.gitOps.checkout(['--ours', filePath]);
                await this.gitOps.stageAll();
            }
        }
    }

    private async resolveConflict(filePath: string): Promise<void> {
        const normalizedPath = normalizePath(filePath);

        const content = await this.app.vault.adapter.read(normalizedPath);

        if (this.hasConflictMarkers(content)) {
            await this.createConflictCopy(filePath, content);

            await this.gitOps.checkout(['--ours', filePath]);

            new Notice(`Conflict detected in ${filePath}. Created conflict copy.`);
        } else {
            await this.gitOps.checkout(['--ours', filePath]);
        }

        await this.gitOps.stageAll();
    }

    private hasConflictMarkers(content: string): boolean {
        return (
            content.includes('<<<<<<<') &&
            content.includes('=======') &&
            content.includes('>>>>>>>')
        );
    }

    private async createConflictCopy(filePath: string, content: string): Promise<void> {
        const conflictPath = PathUtils.generateConflictPath(filePath);
        const normalized = normalizePath(conflictPath);

        await this.app.vault.adapter.write(normalized, content);
    }
}