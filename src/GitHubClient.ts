import { Octokit } from '@octokit/rest';
import { FileChange } from './FileScanner';
import { GitGlassError, withRetry, isNetworkError } from './Errors';

export class GitHubClient {
    private octokit: Octokit;

    constructor(
        token: string,
        private owner: string,
        private repo: string,
        private branch: string
    ) {
        if (!token) {
            throw new GitGlassError(
                'AUTH_REQUIRED',
                'GitHub token is required',
                true
            );
        }

        this.octokit = new Octokit({ auth: token });

        this.octokit.hook.error('request', async (error: any) => {
            if (error.status === 401 || error.status === 403) {
                throw new GitGlassError(
                    'INVALID_AUTH_TOKEN',
                    'Invalid GitHub token.',
                    true,
                    error
                );
            }
            if (isNetworkError(error)) {
                throw new GitGlassError(
                    'NETWORK_OFFLINE',
                    'Check your internet connection.',
                    true,
                    error
                );
            }
            throw error;
        });
    }

    private async request<T>(op: () => Promise<T>): Promise<T> {
        return withRetry(op);
    }

    async getLastCommitSha(): Promise<string | null> {
        return this.request(async () => {
            try {
                const { data } = await this.octokit.repos.getBranch({
                    owner: this.owner,
                    repo: this.repo,
                    branch: this.branch
                });
                return data.commit.sha;
            } catch {
                return null;
            }
        });
    }

    async getRemoteTree(sha: string) {
        return this.request(async () => {
            const { data: commit } = await this.octokit.git.getCommit({
                owner: this.owner,
                repo: this.repo,
                commit_sha: sha
            });

            const { data: tree } = await this.octokit.git.getTree({
                owner: this.owner,
                repo: this.repo,
                tree_sha: commit.tree.sha,
                recursive: 'true'
            });

            return tree;
        });
    }

    async createTree(base_tree: string, changes: FileChange[]) {
        return this.request(async () => {
            const tree = changes.map((c) => {
                if (c.sha) {
                    return {
                        path: c.path,
                        mode: c.mode,
                        type: c.type,
                        sha: c.sha
                    };
                }

                const text = new TextDecoder().decode(c.data);

                return {
                    path: c.path,
                    mode: c.mode,
                    type: c.type,
                    content: text
                };
            });

            const { data } = await this.octokit.git.createTree({
                owner: this.owner,
                repo: this.repo,
                base_tree,
                tree
            });

            return data;
        });
    }

    async createCommit(tree: string, parent: string | null, message: string) {
        return this.request(async () => {
            const { data } = await this.octokit.git.createCommit({
                owner: this.owner,
                repo: this.repo,
                message,
                tree,
                parents: parent ? [parent] : []
            });

            return data;
        });
    }

    async updateRef(sha: string) {
        return this.request(async () => {
            await this.octokit.git.updateRef({
                owner: this.owner,
                repo: this.repo,
                ref: `heads/${this.branch}`,
                sha
            });
        });
    }

    async getFileContent(path: string, ref: string): Promise<string | null> {
        return this.request(async () => {
            try {
                const { data } = await this.octokit.repos.getContent({
                    owner: this.owner,
                    repo: this.repo,
                    path,
                    ref
                });

                if (Array.isArray(data) || !('content' in data)) {
                    return null;
                }

                const binary = atob(data.content);
                const bytes = Uint8Array.from(binary, (c) =>
                    c.charCodeAt(0)
                );

                return new TextDecoder().decode(bytes);
            } catch {
                return null;
            }
        });
    }
}