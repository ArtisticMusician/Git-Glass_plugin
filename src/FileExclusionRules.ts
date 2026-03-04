/**
 * Centralized file exclusion rules for Git Glass sync operations.
 * Used by both mobile and desktop providers to determine which files to skip.
 */
export class FileExclusionRules {
    private static readonly EXCLUSION_PATTERNS = [
        '.git/',
        '.obsidian/workspace',
        '.obsidian/workspace.json',
        '.obsidian/workspace-mobile.json',
        '.trash/'
    ];

    /**
     * Check if a file path should be excluded from sync operations.
     */
    static shouldExclude(path: string): boolean {
        return this.EXCLUSION_PATTERNS.some(pattern => {
            if (pattern.endsWith('/')) {
                return path.startsWith(pattern);
            } else {
                return path === pattern;
            }
        });
    }

    /**
     * Get all exclusion patterns for reference or .gitignore generation.
     */
    static getPatterns(): string[] {
        return [...this.EXCLUSION_PATTERNS];
    }

    /**
     * Add a custom exclusion pattern at runtime if needed.
     */
    static addPattern(pattern: string): void {
        if (!this.EXCLUSION_PATTERNS.includes(pattern)) {
            this.EXCLUSION_PATTERNS.push(pattern);
        }
    }

    /**
     * Generate .gitignore content with default Obsidian exclusions.
     */
    static generateGitignore(): string {
        return `# Obsidian
.obsidian/workspace
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.trash/
.DS_Store
`;
    }
}