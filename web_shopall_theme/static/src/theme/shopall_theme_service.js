/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { registry } from "@web/core/registry";

const STORAGE_KEY = "web_shopall_theme.primary";

function normalizeHex(hex) {
    let h = (hex || "").trim();
    if (!h.startsWith("#")) {
        h = `#${h}`;
    }
    if (h.length === 4) {
        h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
    }
    return /^#[0-9a-fA-F]{6}$/.test(h) ? h : null;
}

function mixChannel(a, b, ratio) {
    return Math.round(a + (b - a) * ratio);
}

/**
 * @param {string} hex #rrggbb
 * @param {number} toward 0 = black, 1 = white
 */
function mixWithWhiteBlack(hex, toward) {
    const h = normalizeHex(hex);
    if (!h) {
        return null;
    }
    const n = parseInt(h.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const end = toward >= 0.5 ? 255 : 0;
    const ratio = toward >= 0.5 ? (toward - 0.5) * 2 : (0.5 - toward) * 2;
    const nr = mixChannel(r, end, ratio);
    const ng = mixChannel(g, end, ratio);
    const nb = mixChannel(b, end, ratio);
    return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
}

export const SHOPALL_THEME_PRESETS = [
    { id: "violet", label: "Shopall", color: "#5b4fec" },
    { id: "indigo", label: "Indigo", color: "#4f46e5" },
    { id: "teal", label: "Teal", color: "#0d9488" },
    { id: "rose", label: "Rose", color: "#e11d48" },
    { id: "amber", label: "Amber", color: "#d97706" },
    { id: "slate", label: "Slate", color: "#475569" },
];

export const shopallThemeService = {
    dependencies: [],
    start() {
        /**
         * Apply accent color and derived tokens to :root (Bootstrap/Odoo primary follows via shopall_dynamic.scss).
         * @param {string} hex
         */
        function applyPrimary(hex) {
            const base = normalizeHex(hex);
            if (!base) {
                return;
            }
            const root = document.documentElement;
            root.style.setProperty("--shopall-primary", base);
            const dark = mixWithWhiteBlack(base, 0.35) || "#4338ca";
            const light = mixWithWhiteBlack(base, 0.88) || "#ede9fd";
            root.style.setProperty("--shopall-primary-dark", dark);
            root.style.setProperty("--shopall-primary-light", light);
            browser.localStorage.setItem(STORAGE_KEY, base);
        }

        function resetPrimary() {
            document.documentElement.style.removeProperty("--shopall-primary");
            document.documentElement.style.removeProperty("--shopall-primary-dark");
            document.documentElement.style.removeProperty("--shopall-primary-light");
            browser.localStorage.removeItem(STORAGE_KEY);
        }

        const stored = browser.localStorage.getItem(STORAGE_KEY);
        if (stored && normalizeHex(stored)) {
            applyPrimary(stored);
        }

        return {
            applyPrimary,
            resetPrimary,
            presets: SHOPALL_THEME_PRESETS,
        };
    },
};

registry.category("services").add("shopall_theme", shopallThemeService);
