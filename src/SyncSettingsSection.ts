import { Setting } from 'obsidian';
import GitGlassPlugin from './main';

export class SyncSettingsSection {
    private plugin: GitGlassPlugin;

    constructor(plugin: GitGlassPlugin) {
        this.plugin = plugin;
    }

    render(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Sync Configuration' });

        new Setting(containerEl)
            .setName('Auto Sync')
            .setDesc('Automatically sync at regular intervals')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSync)
                .onChange(async (value) => {
                    this.plugin.settings.autoSync = value;
                    await this.plugin.saveSettings();
                }));

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
}