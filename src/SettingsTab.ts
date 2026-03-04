import { App, PluginSettingTab, Setting, Platform, Notice } from 'obsidian';
import GitGlassPlugin from './main';
import { GIT_GLASS_LOGO_SVG } from './LogoAsset';

export class GitGlassSettingTab extends PluginSettingTab {
    plugin: GitGlassPlugin;

    constructor(app: App, plugin: GitGlassPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        const header = containerEl.createEl('div', { cls: 'git-glass-logo-container', attr: { style: 'text-align: center; padding: 10px 0; width: 100%; display: flex; justify-content: center; align-items: center;' } });
        header.innerHTML = GIT_GLASS_LOGO_SVG;
        const svgElement = header.querySelector('svg');
        if (svgElement) {
            svgElement.style.maxHeight = '200px';
            svgElement.style.width = 'auto';
            svgElement.style.display = 'block';
            svgElement.style.margin = '0 auto';
        }

        containerEl.createEl('h2', { text: 'Git Glass Settings' });

        this.displayGitHubSettings(containerEl);
        this.displaySyncSettings(containerEl);

        if (Platform.isDesktop) {
            this.displayDesktopSettings(containerEl);
        }
    }

    private displayGitHubSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'GitHub Configuration' });

        // 1
        new Setting(containerEl)
            .setName('GitHub Personal Access Token')
            .setDesc('Token with repo permissions')
            .addText(text => {
                text.setPlaceholder('ghp_xxxxxxxxxxxx')
                    .setValue(this.plugin.settings.githubToken)
                    .onChange(async (value) => {
                        this.plugin.settings.githubToken = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.style.width = '100%';
                text.inputEl.style.maxWidth = '400px';
            });

        // 2
        new Setting(containerEl)
            .setName('Repository URL')
            .setDesc('(e.g. https://github.com/username/my-vault.git)')
            .addText(text => {
                text.setPlaceholder('https://github.com/username/my-vault.git')
                    .setValue(this.plugin.settings.remoteUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.remoteUrl = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.style.width = '100%';
                text.inputEl.style.maxWidth = '400px';
            });

        // 3
        new Setting(containerEl)
            .setName('Branch')
            .setDesc('Branch to sync with')
            .addText(text => text
                .setPlaceholder('main')
                .setValue(this.plugin.settings.branch)
                .onChange(async (value) => {
                    this.plugin.settings.branch = value;
                    await this.plugin.saveSettings();
                }));

        // 4 — desktop only
        if (Platform.isDesktop) {
            new Setting(containerEl)
                .setName('Repository Setup')
                .setDesc('Initialize git repository with current settings')
                .addButton(button => button
                    .setButtonText('Initialize Repository')
                    .setCta()
                    .onClick(async () => {
                        await this.plugin.initializeRepository();
                    }));
        }
    }

    private displaySyncSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Sync Configuration' });

        // 5
        new Setting(containerEl)
            .setName('Sync Now')
            .setDesc('Trigger a manual sync immediately (Push & Pull)')
            .addButton(button => button
                .setButtonText('Sync Now')
                .setCta()
                .onClick(async () => {
                    this.plugin.showNotice('Starting manual sync...');
                    await this.plugin.performSync();
                }));

        // 6 — desktop only
        if (Platform.isDesktop) {
            new Setting(containerEl)
                .setName('Repository Status')
                .setDesc('Check current git status')
                .addButton(button => button
                    .setButtonText('Show Status')
                    .onClick(async () => {
                        await this.plugin.showGitStatus();
                    }));
        }

        // 7
        new Setting(containerEl)
            .setName('Auto Sync')
            .setDesc('Automatically sync at regular intervals')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSync)
                .onChange(async (value) => {
                    this.plugin.settings.autoSync = value;
                    await this.plugin.saveSettings();
                }));

        // 8
        new Setting(containerEl)
            .setName('Sync Interval')
            .setDesc('Minutes between automatic syncs')
            .addText(text => text
                .setPlaceholder('5')
                .setValue(String(this.plugin.settings.syncInterval))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.syncInterval = num;
                        await this.plugin.saveSettings();
                    }
                }));
    }

    private displayDesktopSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Desktop Configuration' });

        // 9
        new Setting(containerEl)
            .setName('Use Native Git')
            .setDesc('Use local git binary (recommended). Disable to use GitHub API instead.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useNativeGit)
                .onChange(async (value) => {
                    this.plugin.settings.useNativeGit = value;
                    await this.plugin.saveSettings();
                }));

        // 10
        new Setting(containerEl)
            .setName('Git Executable Path')
            .setDesc('Path to git binary (leave as "git" if in PATH)')
            .addText(text => text
                .setPlaceholder('git')
                .setValue(this.plugin.settings.gitExecutablePath)
                .onChange(async (value) => {
                    this.plugin.settings.gitExecutablePath = value;
                    await this.plugin.saveSettings();
                }));
    }
}
