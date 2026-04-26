/**
 * Content Configuration Loader
 *
 * Loads and validates content theme configurations from JSON files.
 * Singleton pattern - instantiated once at server startup.
 */

import * as fs from "fs";
import * as path from "path";
import { ContentThemeConfig } from "./types";

export class ContentConfigLoader {
  private configs: Map<string, ContentThemeConfig> = new Map();
  private initialized: boolean = false;

  /**
   * Load all content configurations at server startup
   */
  public initialize(): void {
    if (this.initialized) {
      console.warn("[ContentConfigLoader] Already initialized");
      return;
    }

    console.log("[ContentConfigLoader] Loading content configurations...");

    try {
      // Load philosophy theme
      const philosophyPath = path.join(
        __dirname,
        "philosophy_content_config.json",
      );
      const philosophyData = fs.readFileSync(philosophyPath, "utf-8");
      const philosophyConfig: ContentThemeConfig = JSON.parse(philosophyData);

      this.configs.set(philosophyConfig.tableThemeKey, philosophyConfig);

      console.log(
        `[ContentConfigLoader] ✅ Loaded theme: ${philosophyConfig.tableThemeKey} (${philosophyConfig.subjects.length} subjects)`,
      );

      this.initialized = true;
    } catch (error) {
      console.error(
        "[ContentConfigLoader] ❌ Failed to load configurations:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get configuration for a specific theme
   */
  public getConfig(themeKey: string): ContentThemeConfig | null {
    if (!this.initialized) {
      console.error(
        "[ContentConfigLoader] Not initialized - call initialize() first",
      );
      return null;
    }

    const config = this.configs.get(themeKey);
    if (!config) {
      console.error(`[ContentConfigLoader] Unknown theme: ${themeKey}`);
      return null;
    }

    return config;
  }

  /**
   * Get random question from a subject within a theme
   */
  public getRandomQuestion(
    themeKey: string,
    subjectKey: string,
  ): { id: string; text: string } | null {
    const config = this.getConfig(themeKey);
    if (!config) return null;

    const subject = config.subjects.find((s) => s.key === subjectKey);
    if (!subject || subject.questions.length === 0) {
      console.error(
        `[ContentConfigLoader] No questions for subject: ${subjectKey}`,
      );
      return null;
    }

    const randomIndex = Math.floor(Math.random() * subject.questions.length);
    const question = subject.questions[randomIndex];

    return {
      id: question.id,
      text: question.text,
    };
  }

  /**
   * Get all available themes
   */
  public getAvailableThemes(): string[] {
    return Array.from(this.configs.keys());
  }
}

// Singleton instance
export const contentConfigLoader = new ContentConfigLoader();
