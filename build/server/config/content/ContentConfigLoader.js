"use strict";
/**
 * Content Configuration Loader
 *
 * Loads and validates content theme configurations from JSON files.
 * Singleton pattern - instantiated once at server startup.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentConfigLoader = exports.ContentConfigLoader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ContentConfigLoader {
    constructor() {
        this.configs = new Map();
        this.initialized = false;
    }
    /**
     * Load all content configurations at server startup
     */
    initialize() {
        if (this.initialized) {
            console.warn("[ContentConfigLoader] Already initialized");
            return;
        }
        console.log("[ContentConfigLoader] Loading content configurations...");
        try {
            // Load philosophy theme
            const philosophyPath = path.join(__dirname, "philosophy_content_config.json");
            const philosophyData = fs.readFileSync(philosophyPath, "utf-8");
            const philosophyConfig = JSON.parse(philosophyData);
            this.configs.set(philosophyConfig.tableThemeKey, philosophyConfig);
            console.log(`[ContentConfigLoader] ✅ Loaded theme: ${philosophyConfig.tableThemeKey} (${philosophyConfig.subjects.length} subjects)`);
            this.initialized = true;
        }
        catch (error) {
            console.error("[ContentConfigLoader] ❌ Failed to load configurations:", error);
            throw error;
        }
    }
    /**
     * Get configuration for a specific theme
     */
    getConfig(themeKey) {
        if (!this.initialized) {
            console.error("[ContentConfigLoader] Not initialized - call initialize() first");
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
    getRandomQuestion(themeKey, subjectKey) {
        const config = this.getConfig(themeKey);
        if (!config)
            return null;
        const subject = config.subjects.find((s) => s.key === subjectKey);
        if (!subject || subject.questions.length === 0) {
            console.error(`[ContentConfigLoader] No questions for subject: ${subjectKey}`);
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
    getAvailableThemes() {
        return Array.from(this.configs.keys());
    }
}
exports.ContentConfigLoader = ContentConfigLoader;
// Singleton instance
exports.contentConfigLoader = new ContentConfigLoader();
