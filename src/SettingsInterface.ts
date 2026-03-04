export interface GitGlassSettings {
    githubToken: string;
    remoteUrl: string; // e.g. https://github.com/user/repo.git — owner and repo are parsed from this
    branch: string;
    syncInterval: number; // minutes
    autoSync: boolean;
    gitExecutablePath: string; // for desktop
    useNativeGit: boolean; // desktop: true = native git, false = GitHub API
}

export const DEFAULT_SETTINGS: GitGlassSettings = {
    githubToken: '',
    remoteUrl: '',
    branch: 'main',
    syncInterval: 5,
    autoSync: false,
    gitExecutablePath: 'git',
    useNativeGit: true
};
