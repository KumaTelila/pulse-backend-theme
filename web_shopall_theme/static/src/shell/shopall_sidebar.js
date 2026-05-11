/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { router, routerBus } from "@web/core/browser/router";
import { browser } from "@web/core/browser/browser";
import { useBus, useService } from "@web/core/utils/hooks";
import { user, userBus } from "@web/core/user";
import { imageUrl } from "@web/core/utils/urls";

/**
 * Left sidebar: accordion menu tree from ir.ui.menu.
 * Groups stay collapsed until the user opens them (no auto-expand from route).
 */
export class ShopallSidebar extends Component {
    static template = "web_shopall_theme.ShopallSidebar";
    static props = {};

    setup() {
        this.menuService = useService("menu");
        this.actionService = useService("action");
        this.orm = useService("orm");
        this.state = useState({
            expandedApps: {},
            expandedNodes: {},
            companyLogoFailed: false,
        });
        // Re-render for active leaf highlighting only (accordion state is manual).
        useBus(routerBus, "ROUTE_CHANGE", () => this.render());
        useBus(this.env.bus, "MENUS:APP-CHANGED", () => this.render());
        useBus(this.env.bus, "ACTION_MANAGER:UI-UPDATED", () => this.render());
        useBus(userBus, "ACTIVE_COMPANIES_CHANGED", () => {
            this.state.companyLogoFailed = false;
        });
    }

    get apps() {
        return this.menuService.getApps();
    }

    get companyName() {
        return user.activeCompany?.name?.trim() || "";
    }

    get companyInitial() {
        const n = this.companyName;
        return n ? n.charAt(0).toUpperCase() : "C";
    }

    get companyLogoUrl() {
        if (this.state.companyLogoFailed) {
            return "";
        }
        const c = user.activeCompany;
        if (!c?.id) {
            return "";
        }
        return imageUrl("res.company", c.id, "logo", { width: 128, height: 128 });
    }

    onCompanyHeaderLogoError() {
        this.state.companyLogoFailed = true;
    }

    get userName() {
        return user.name || "";
    }

    get userEmail() {
        return user.login || "";
    }

    get userInitials() {
        const n = this.userName.trim();
        if (!n) {
            return "?";
        }
        const parts = n.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return n.slice(0, 2).toUpperCase();
    }

    get userAvatarSrc() {
        if (!user.partnerId) {
            return "";
        }
        return imageUrl("res.partner", user.partnerId, "avatar_128", {
            unique: user.writeDate,
        });
    }

    get discussMenu() {
        const apps = this.menuService.getApps();
        let m = apps.find((a) => a.name === "Discuss");
        if (!m) {
            m = apps.find((a) => a.actionPath && String(a.actionPath).includes("discuss"));
        }
        if (!m) {
            m = this.menuService.getAll().find((item) => item.xmlid === "mail.menu_root_discuss");
        }
        return m;
    }

    appTree(app) {
        return this.menuService.getMenuAsTree(app.id);
    }

    getMenuItemHref(menu) {
        if (!menu.actionID) {
            return "#";
        }
        return `/odoo/${menu.actionPath || "action-" + menu.actionID}`;
    }

    isAppExpanded(app) {
        return !!this.state.expandedApps[app.id];
    }

    toggleApp(app, ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        const id = app.id;
        const next = !this.state.expandedApps[id];
        this.state.expandedApps = { ...this.state.expandedApps, [id]: next };
    }

    isNodeExpanded(menu) {
        return !!this.state.expandedNodes[menu.id];
    }

    toggleNode(menu, ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        const id = menu.id;
        const next = !this.state.expandedNodes[id];
        this.state.expandedNodes = { ...this.state.expandedNodes, [id]: next };
    }

    hasMenuBranches(menu) {
        return !!(menu.childrenTree && menu.childrenTree.length);
    }

    isAppActive(app) {
        return this.menuService.getCurrentApp() === app;
    }

    isDashboardActive() {
        const ctrl = this.actionService.currentController;
        return ctrl?.action?.tag === "shopall_dashboard";
    }

    async onDashboardClick(ev) {
        ev.preventDefault();
        await this.actionService.doAction("web_shopall_theme.action_shopall_dashboard");
    }

    async openMyPreferences() {
        const actionDescription = await this.orm.call("res.users", "action_get");
        actionDescription.res_id = user.userId;
        await this.actionService.doAction(actionDescription);
    }

    async onDiscussClick(ev) {
        ev.preventDefault();
        const menu = this.discussMenu;
        if (menu?.actionID) {
            await this.menuService.selectMenu(menu);
        } else {
            browser.location.href = "/odoo/discuss";
        }
    }

    async onPreferencesClick(ev) {
        ev.preventDefault();
        await this.openMyPreferences();
    }

    onLogoutClick(ev) {
        ev.preventDefault();
        browser.location.href = "/web/session/logout";
    }

    async onUserCardClick(ev) {
        ev.preventDefault();
        await this.openMyPreferences();
    }

    onMenuLeafClick(menu, ev) {
        ev.preventDefault();
        if (menu.actionID) {
            this.menuService.selectMenu(menu);
        }
    }

    isLeafActive(menu) {
        if (!menu.actionID) {
            return false;
        }
        const mid = Number(router.current.menu_id || 0);
        if (mid && mid === menu.id) {
            return true;
        }
        const ctrl = this.actionService.currentController;
        if (!ctrl) {
            return false;
        }
        const aid = ctrl.action?.id;
        if (aid && menu.actionID === aid) {
            return true;
        }
        const path = router.current.action;
        return !!(menu.actionPath && path && String(path) === String(menu.actionPath));
    }

    /**
     * Indent from sidebar edge by tree depth (design: folder 34px, leaf 48px, +14px each level).
     */
    subFolderRowStyle(level) {
        const l = Number(level) || 1;
        const padLeft = 34 + (l - 1) * 14;
        return `padding: 6px 14px 6px ${padLeft}px; margin: 1px 8px;`;
    }

    leafRowStyle(level) {
        const l = Number(level) || 1;
        const padLeft = 48 + (l - 1) * 14;
        return `padding: 6px 14px 6px ${padLeft}px; margin: 1px 8px;`;
    }
}
