import { normalizePath } from 'obsidian';

export class PathUtils {
    static normalize(path: string): string {
        return normalizePath(path);
    }

    static getDirectory(filePath: string): string {
        const lastSlash = filePath.lastIndexOf('/');
        return lastSlash > 0 ? filePath.substring(0, lastSlash) : '';
    }

    static getExtension(filePath: string): string {
        const lastDot = filePath.lastIndexOf('.');
        return lastDot > 0 ? filePath.substring(lastDot) : '';
    }

    static getBasePath(filePath: string): string {
        const lastDot = filePath.lastIndexOf('.');
        return lastDot > 0 ? filePath.substring(0, lastDot) : filePath;
    }

    static getFilename(filePath: string): string {
        const lastSlash = filePath.lastIndexOf('/');
        return lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;
    }

    static generateConflictPath(originalPath: string): string {
        const timestamp = this.formatTimestampForFilename(new Date());
        const ext = this.getExtension(originalPath);
        const basePath = this.getBasePath(originalPath);

        return `${basePath} (Conflict - ${timestamp})${ext}`;
    }

    static formatTimestampForFilename(date: Date): string {
        return date.toISOString().replace(/:/g, '-').split('.')[0];
    }

    static isDirectory(path: string): boolean {
        return path.endsWith('/');
    }

    static join(...segments: string[]): string {
        return normalizePath(segments.join('/'));
    }
}