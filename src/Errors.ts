export class GitGlassError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly isUserFriendly: boolean = false,
        public readonly cause?: Error
    ) {
        super(message);
        this.name = 'GitGlassError';
        Object.setPrototypeOf(this, GitGlassError.prototype);
    }
}

export const ERROR_MESSAGES: Record<string, string> = {
    INVALID_AUTH_TOKEN: 'Invalid GitHub token. Please update your token in settings.',
    AUTH_REQUIRED: 'Authentication is required. Please configure your GitHub token.',

    REPO_NOT_FOUND: 'Repository not found. Please check the repository name and owner.',
    REPO_NOT_INITIALIZED: 'Git repository is not initialized. Please initialize it first.',
    NOT_A_REPO: 'The current vault is not a Git repository.',

    NETWORK_OFFLINE: 'Network is offline. Please check your internet connection.',
    RATE_LIMIT_EXCEEDED: 'GitHub API rate limit exceeded. Please try again later.',

    CONFLICT_CREATED: 'Sync completed with conflicts. Resolve them and sync again.',
    MERGE_CONFLICT: 'Merge conflict detected. Please resolve conflicts before syncing.',
    SYNC_FAILED: 'Failed to sync changes. Please try again.',

    FILE_ACCESS_DENIED: 'Permission denied while accessing files.',
    FILE_NOT_FOUND: 'Required file not found.',

    UNKNOWN_ERROR: 'An unexpected error occurred. Please check the console for details.'
};

export function isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    return [
        'ENOTFOUND',
        'ETIMEDOUT',
        'ECONNABORTED',
        'ECONNRESET',
        'ENETUNREACH'
    ].some(code => error.message.includes(code));
}

export function getErrorMessage(error: unknown): string {
    if (error instanceof GitGlassError) {
        return error.isUserFriendly
            ? error.message
            : ERROR_MESSAGES[error.code] || ERROR_MESSAGES.UNKNOWN_ERROR;
    }

    if (error instanceof Error) {
        if (isNetworkError(error)) {
            return ERROR_MESSAGES.NETWORK_OFFLINE;
        }
        return error.message;
    }

    return ERROR_MESSAGES.UNKNOWN_ERROR;
}

export async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;

            if (
                error instanceof GitGlassError &&
                [
                    'INVALID_AUTH_TOKEN',
                    'AUTH_REQUIRED',
                    'REPO_NOT_FOUND',
                    'REPO_NOT_INITIALIZED'
                ].includes(error.code)
            ) {
                throw error;
            }

            if (attempt === maxRetries) break;

            const delay = baseDelay * Math.pow(2, attempt - 1);
            const jitter = Math.random() * 1000;

            await new Promise(resolve =>
                setTimeout(resolve, delay + jitter)
            );
        }
    }

    throw lastError || new GitGlassError('UNKNOWN_ERROR', 'Operation failed after retries');
}

export async function safeAsyncOperation<T>(
    operation: () => Promise<T>,
    context: string = 'unknown'
): Promise<{ data?: T; error?: GitGlassError }> {
    try {
        const data = await operation();
        return { data };
    } catch (error) {
        if (error instanceof GitGlassError) {
            console.error(`[${context}] ${error.code}: ${error.message}`, error.cause);
            return { error };
        }

        const wrapped = new GitGlassError(
            'UNKNOWN_ERROR',
            error instanceof Error ? error.message : 'An unknown error occurred',
            false,
            error instanceof Error ? error : undefined
        );

        console.error(`[${context}] Unhandled error:`, wrapped);
        return { error: wrapped };
    }
}