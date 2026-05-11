/** @odoo-module **/

import { Component, onMounted, onWillUnmount, useState } from "@odoo/owl";
import { router, routerBus } from "@web/core/browser/router";
import { browser } from "@web/core/browser/browser";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { useDropdownCloser } from "@web/core/dropdown/dropdown_hooks";
import { useBus, useService } from "@web/core/utils/hooks";
import { user, userBus } from "@web/core/user";
import { imageUrl } from "@web/core/utils/urls";

const SIDEBAR_NARROW_KEY = "web_shopall_theme.sidebar_narrow";

/**
 * Flyout body for collapsed sidebar: same tree as MenuBranch but closes the parent
 * Dropdown after a leaf is chosen (popover env provides dropdown nesting).
 */
class ShopallSidebarNarrowFlyoutMenu extends Component {
    static template = "web_shopall_theme.ShopallSidebarNarrowFlyoutMenu";
    static props = {
        app: Object,
        sidebar: Object,
    };

    setup() {
        this.flyoutCloser = useDropdownCloser();
    }

    get menuTreeChildren() {
        return this.props.sidebar.appTree(this.props.app).childrenTree || [];
    }

    hasMenuBranches(menu) {
        return this.props.sidebar.hasMenuBranches(menu);
    }

    isNodeExpanded(menu) {
        return this.props.sidebar.isNodeExpanded(menu);
    }

    toggleNode(menu, ev) {
        return this.props.sidebar.toggleNode(menu, ev);
    }

    getMenuItemHref(menu) {
        return this.props.sidebar.getMenuItemHref(menu);
    }

    isLeafActive(menu) {
        return this.props.sidebar.isLeafActive(menu);
    }

    subFolderRowStyle(level) {
        return this.props.sidebar.subFolderRowStyle(level);
    }

    leafRowStyle(level) {
        return this.props.sidebar.leafRowStyle(level);
    }

    async onMenuLeafClickInFlyout(menu, ev) {
        await this.props.sidebar.onMenuLeafClick(menu, ev);
        this.flyoutCloser.closeAll();
    }
}

/**
 * Left sidebar: accordion menu tree from ir.ui.menu.
 * Groups stay collapsed until the user opens them (no auto-expand from route).
 */
export class ShopallSidebar extends Component {
    static template = "web_shopall_theme.ShopallSidebar";
    static components = { Dropdown, ShopallSidebarNarrowFlyoutMenu };
    static props = {};

    setup() {
        this.menuService = useService("menu");
        this.actionService = useService("action");
        this.orm = useService("orm");
        const initialNarrow = browser.localStorage.getItem(SIDEBAR_NARROW_KEY) === "1";
        this.state = useState({
            expandedApps: {},
            expandedNodes: {},
            companyLogoFailed: false,
            /** Disambiguates multiple ir.ui.menu leaves that share the same action. */
            sidebarLeafId: null,
            /** Icon-only / narrow rail (persisted). */
            sidebarNarrow: initialNarrow,
        });
        this._syncSidebarCollapsedClass(initialNarrow);
        onMounted(() => {
            this._syncSidebarCollapsedClass(this.state.sidebarNarrow);
        });
        onWillUnmount(() => {
            document.body.classList.remove("o_shopall_sidebar_collapsed");
        });
        // Re-render for active leaf highlighting only (accordion state is manual).
        useBus(routerBus, "ROUTE_CHANGE", () => {
            this._pruneSidebarLeafSelection();
            this.render();
        });
        useBus(this.env.bus, "MENUS:APP-CHANGED", () => {
            this._pruneSidebarLeafSelection();
            this.render();
        });
        useBus(this.env.bus, "ACTION_MANAGER:UI-UPDATED", () => {
            this._pruneSidebarLeafSelection();
            this.render();
        });
        useBus(userBus, "ACTIVE_COMPANIES_CHANGED", () => {
            this.state.companyLogoFailed = false;
        });
    }

    _syncSidebarCollapsedClass(narrow) {
        document.body.classList.toggle("o_shopall_sidebar_collapsed", !!narrow);
    }

    toggleSidebarNarrow(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const next = !this.state.sidebarNarrow;
        this.state.sidebarNarrow = next;
        browser.localStorage.setItem(SIDEBAR_NARROW_KEY, next ? "1" : "0");
        this._syncSidebarCollapsedClass(next);
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

    hasAppTreeChildren(app) {
        const children = this.appTree(app).childrenTree;
        return !!(children && children.length);
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

    async onNarrowAppWithoutChildren(app, ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        if (app.actionID) {
            await this.menuService.selectMenu(app);
        }
    }

    /** Props for {@link ShopallSidebarNarrowFlyoutMenu} (QWeb-friendly). */
    narrowFlyoutMenuProps(app) {
        return { app, sidebar: this };
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
        // Overview is a client action outside the app menu tree; getCurrentApp()
        // can remain the last app (e.g. Sales), so never mark an app row active on Overview.
        if (this.isDashboardActive()) {
            return false;
        }
        return this.menuService.getCurrentApp() === app;
    }

    isDashboardActive() {
        const ctrl = this.actionService.currentController;
        return ctrl?.action?.tag === "shopall_dashboard";
    }

    async onDashboardClick(ev) {
        ev.preventDefault();
        this.state.sidebarLeafId = null;
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

    /**
     * Flat "leaf" menus for the current app + URL action (same app root as getCurrentApp).
     */
    _leafMenuCandidatesForCurrentAction() {
        if (this.isDashboardActive()) {
            return [];
        }
        const currentApp = this.menuService.getCurrentApp();
        if (!currentApp) {
            return [];
        }
        const ctrl = this.actionService.currentController;
        if (!ctrl?.action) {
            return [];
        }
        const actionId = typeof ctrl.action.id === "number" ? ctrl.action.id : null;
        const pathFromRouter = router.current.action;
        const menus = this.menuService.getAll();
        return menus.filter((m) => {
            if (!m.actionID || m.appID !== currentApp.id) {
                return false;
            }
            if (m.children && m.children.length) {
                return false;
            }
            if (actionId !== null && m.actionID === actionId) {
                return true;
            }
            if (
                m.actionPath &&
                pathFromRouter != null &&
                pathFromRouter !== "" &&
                String(m.actionPath) === String(pathFromRouter)
            ) {
                return true;
            }
            return false;
        });
    }

    _pruneSidebarLeafSelection() {
        if (this.isDashboardActive()) {
            this.state.sidebarLeafId = null;
            return;
        }
        const candidates = this._leafMenuCandidatesForCurrentAction();
        if (
            this.state.sidebarLeafId &&
            candidates.length &&
            !candidates.some((c) => c.id === this.state.sidebarLeafId)
        ) {
            this.state.sidebarLeafId = null;
        }
    }

    /**
     * When several menu entries share one action, only one row should look active:
     * prefer URL menu_id, then last leaf clicked from the sidebar.
     */
    _resolvedActiveLeafId() {
        if (this.isDashboardActive()) {
            return null;
        }
        const candidates = this._leafMenuCandidatesForCurrentAction();
        if (candidates.length === 1) {
            return candidates[0].id;
        }
        if (candidates.length > 1) {
            const menuIdFromUrl = Number(router.current.menu_id || 0);
            if (menuIdFromUrl && candidates.some((c) => c.id === menuIdFromUrl)) {
                return menuIdFromUrl;
            }
            if (this.state.sidebarLeafId && candidates.some((c) => c.id === this.state.sidebarLeafId)) {
                return this.state.sidebarLeafId;
            }
            return null;
        }
        return null;
    }

    async onMenuLeafClick(menu, ev) {
        ev.preventDefault();
        this.state.sidebarLeafId = menu.id;
        if (menu.actionID) {
            await this.menuService.selectMenu(menu);
        }
    }

    isLeafActive(menu) {
        if (!menu.actionID) {
            return false;
        }
        return this._resolvedActiveLeafId() === menu.id;
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
