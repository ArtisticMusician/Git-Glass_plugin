import { Notice, Plugin, Platform, addIcon } from 'obsidian';
import { GitGlassSettings, DEFAULT_SETTINGS } from './SettingsInterface';
import { GitGlassSettingTab } from './SettingsTab';
import { SyncManager } from './SyncManager';
import { ConflictResolutionModal } from './ConflictModal';

export default class GitGlassPlugin extends Plugin {
  settings: GitGlassSettings;
  syncManager: SyncManager;
  statusBarItem: HTMLElement;
  syncInterval: number | null = null;

  /**
   * Shows a premium, centered Git Glass notice
   */
  showNotice(message: string, duration: number = 5000): Notice {
    const notice = new Notice(message, duration);
    // Add custom class for centering and glassmorphism
    // Since Notice.noticeEl is internal/not officially exposed in types, we use type assertion
    (notice as any).noticeEl?.addClass('git-glass-notice');
    return notice;
  }

  async onload() {
    this.registerCustomIcons();
    await this.loadSettings();

    // Initialize sync manager
    this.syncManager = new SyncManager(this.app, this.settings, (msg) => this.showNotice(msg));
    try {
      await this.syncManager.initialize();
    } catch (e) {
      console.error("Git Glass: Initialization failed, but UI will load.", e);
      this.showNotice("Git Glass Error: Initialization failed. Please check settings.");
    }

    // Add status bar
    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBar('idle');

    // Register UI elements
    this.registerCommands();
    this.registerRibbonIcon();
    this.addSettingTab(new GitGlassSettingTab(this.app, this));

    // Start auto-sync if enabled
    if (this.settings.autoSync) {
      this.startAutoSync();
    }
  }

  private registerCommands(): void {
    this.addCommand({
      id: 'sync-now',
      name: 'Sync Now',
      callback: async () => {
        await this.performSync();
      }
    });

    if (Platform.isDesktop) {
      this.addCommand({
        id: 'init-repo',
        name: 'Initialize Git Repository',
        callback: async () => {
          await this.initializeRepository();
        }
      });

      this.addCommand({
        id: 'show-status',
        name: 'Show Git Status',
        callback: async () => {
          await this.showGitStatus();
        }
      });

      this.addCommand({
        id: 'resolve-conflicts',
        name: 'Resolve Sync Conflicts',
        callback: () => {
          new ConflictResolutionModal(this.app).open();
        }
      });
    }
  }

  private registerRibbonIcon(): void {
    this.addRibbonIcon('git-glass-icon', 'Git Glass Sync', async () => {
      await this.performSync();
    });
  }

  private registerCustomIcons(): void {
    const iconSvg = `
<svg viewBox="0 0 24 24" width="100" height="100">
  <path fill="currentColor" d="m12.019 3.47 4.62 4.678v7.75l-4.619 4.645-4.658-4.65V8.154zM12.025 0 4.94 7.124v9.804l7.085 7.073 7.034-7.073V7.124z"/>
</svg>
    `;
    addIcon('git-glass-icon', iconSvg);
  }

  async performSync(): Promise<void> {
    this.updateStatusBar('syncing');

    const success = await this.syncManager.performSync();

    if (success) {
      this.updateStatusBar('synced');
      setTimeout(() => this.updateStatusBar('idle'), 3000);
    } else {
      this.updateStatusBar('error');
    }
  }

  async initializeRepository(branch?: string): Promise<void> {
    await this.syncManager.initializeRepository(branch);
  }

  async showGitStatus(): Promise<void> {
    const status = await this.syncManager.getStatus();
    this.showNotice(`Git Status: ${status}`, 5000);
  }

  private updateStatusBar(state: 'idle' | 'syncing' | 'synced' | 'error'): void {
    const icons = {
      idle: '○',
      syncing: '↻',
      synced: '✓',
      error: '✗'
    };

    const labels = {
      idle: 'Git Glass',
      syncing: 'Syncing...',
      synced: 'Synced',
      error: 'Sync Error'
    };

    this.statusBarItem.setText(`${icons[state]} ${labels[state]}`);
  }

  private startAutoSync(): void {
    this.stopAutoSync();

    const intervalMs = this.settings.syncInterval * 60 * 1000;
    this.syncInterval = (setInterval as any)(async () => {
      await this.performSync();
    }, intervalMs);

    console.log(`Auto-sync enabled: every ${this.settings.syncInterval} minutes`);
  }

  private stopAutoSync(): void {
    if (this.syncInterval !== null) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);

    // Restart auto-sync if needed (the syncManager uses the same settings reference, so it updates automatically)
    if (this.settings.autoSync) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  onunload(): void {
    this.stopAutoSync();
  }
}