/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { useBus, useService } from "@web/core/utils/hooks";
import { NavBar } from "@web/webclient/navbar/navbar";
import { routerBus } from "@web/core/browser/router";
import { browser } from "@web/core/browser/browser";

patch(NavBar.prototype, {
    setup() {
        super.setup();
        this.commandService = useService("command");
        useBus(this.env.bus, "ACTION_MANAGER:UPDATE", () => this.render());
        useBus(this.env.bus, "ACTION_MANAGER:UI-UPDATED", () => this.render());
        useBus(routerBus, "ROUTE_CHANGE", () => {
            document.body.classList.remove('o_shopall_sidebar_mobile_open');
            this.render();
        });
    },

    openCommandPalette() {
        this.commandService.openMainPalette();
    },

    /**
     * Breadcrumb trail for the top bar (parent segments muted, last segment bold).
     */
    get shopallRouteSegments() {
        const ctrl = this.actionService.currentController;
        const crumbs = ctrl?.config?.breadcrumbs;
        if (crumbs && crumbs.length) {
            return crumbs.map((c, i, arr) => ({
                jsId: c.jsId,
                name: c.name || "…",
                isLast: i === arr.length - 1,
                onSelected: c.onSelected,
            }));
        }
        const name =
            ctrl?.displayName ||
            (ctrl?.action?.tag === "shopall_dashboard" ? "Overview" : "") ||
            this.currentApp?.name ||
            "";
        if (!name) {
            return [];
        }
        return [{ jsId: "shopall-fallback", name, isLast: true, onSelected: null }];
    },

    onShopallHistoryBack(ev) {
        ev.preventDefault();
        browser.history.back();
    },

    onShopallHistoryForward(ev) {
        ev.preventDefault();
        browser.history.forward();
    },

    onShopallCrumbClick(seg, ev) {
        ev.preventDefault();
        seg.onSelected?.();
    },

    toggleMobileSidebar(ev) {
        ev.preventDefault();
        document.body.classList.toggle('o_shopall_sidebar_mobile_open');
    },

    /**
     * With a fixed sidebar, section tabs are horizontally scrolled instead of collapsing into “More”.
     */
    async adapt() {
        if (!this.root.el) {
            return;
        }
        const sectionsMenu = this.appSubMenus.el;
        if (!sectionsMenu) {
            return;
        }
        const hadExtra = this.currentAppSectionsExtra.length > 0;
        const sections = [
            ...sectionsMenu.querySelectorAll(":scope > *:not(.o_menu_sections_more)"),
        ];
        for (const section of sections) {
            section.classList.remove("d-none");
        }
        this.currentAppSectionsExtra = [];
        if (hadExtra) {
            return this.render();
        }
    },
});
