/** @odoo-module **/

import { Component, onMounted, onWillUnmount, useState } from "@odoo/owl";
import { router, routerBus } from "@web/core/browser/router";
import { browser } from "@web/core/browser/browser";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { useDropdownCloser } from "@web/core/dropdown/dropdown_hooks";
import { useBus, useService } from "@web/core/utils/hooks";
import { user, userBus } from "@web/core/user";
import { imageUrl } from "@web/core/utils/urls";
import { session } from "@web/session";

const SIDEBAR_NARROW_KEY = "web_pulse_theme.sidebar_narrow";
const DEFAULT_APP_ICON = "fa-folder-o";
const THEME_APP_ICONS = [
    { match: ["sales", "sale"], icon: "fa-shopping-bag" },
    { match: ["crm"], icon: "fa-handshake-o" },
    { match: ["purchase"], icon: "fa-credit-card" },
    { match: ["inventory", "stock", "warehouse"], icon: "fa-cubes" },
    { match: ["invoice", "invoicing", "accounting", "account"], icon: "fa-calculator" },
    { match: ["employee", "hr"], icon: "fa-users" },
    { match: ["point of sale", "pos"], icon: "fa-shopping-cart" },
    { match: ["project"], icon: "fa-tasks" },
    { match: ["discuss", "mail"], icon: "fa-comments-o" },
    { match: ["website"], icon: "fa-globe" },
    { match: ["calendar"], icon: "fa-calendar" },
    { match: ["contacts"], icon: "fa-address-book-o" },
    { match: ["apps", "settings"], icon: "fa-cog" },
];

/**
 * Flyout body for collapsed sidebar: same tree as MenuBranch but closes the parent
 * Dropdown after a leaf is chosen (popover env provides dropdown nesting).
 */
class PulseSidebarNarrowFlyoutMenu extends Component {
    static template = "web_pulse_theme.PulseSidebarNarrowFlyoutMenu";
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
export class PulseSidebar extends Component {
    static template = "web_pulse_theme.PulseSidebar";
    static components = { Dropdown, PulseSidebarNarrowFlyoutMenu };
    static props = {};

    setup() {
        this.menuService = useService("menu");
        this.actionService = useService("action");
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
        onMounted(() => {
            // Delegate focus handling so focused items are scrolled into view.
            this._pulseFocusHandler = (ev) => {
                try {
                    const target = ev.target;
                    if (!target) return;
                    const row = target.closest(
                        '.o_pulse_sidebar_nav a, .o_pulse_nav_parent, .o_pulse_nav_leaf, .o_pulse_sidebar_app_block button'
                    );
                    if (row && row.scrollIntoView) {
                        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }
                } catch (e) {
                    // ignore
                }
            };
            document.addEventListener('focusin', this._pulseFocusHandler, true);
        });

        onWillUnmount(() => {
            document.body.classList.remove("o_pulse_sidebar_collapsed");
            if (this._pulseFocusHandler) {
                document.removeEventListener('focusin', this._pulseFocusHandler, true);
                this._pulseFocusHandler = null;
            }
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
        document.body.classList.toggle("o_pulse_sidebar_collapsed", !!narrow);
    }

    toggleSidebarNarrow(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const next = !this.state.sidebarNarrow;
        this.state.sidebarNarrow = next;
        browser.localStorage.setItem(SIDEBAR_NARROW_KEY, next ? "1" : "0");
        this._syncSidebarCollapsedClass(next);
    }

    onSidebarToggleClick(ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        // On small/medium screens, behave as a close button for the mobile sidebar.
        if (typeof window !== 'undefined' && window.matchMedia) {
            const isMobile = window.matchMedia('(max-width: 991.98px)').matches;
            if (isMobile) {
                this.closeMobileSidebar(ev);
                return;
            }
        }
        // Otherwise toggle narrow (desktop behavior)
        return this.toggleSidebarNarrow(ev);
    }

    get apps() {
        return this.menuService.getApps();
    }

    get appIconStyle() {
        return session.pulse_theme?.app_icon_style || "pulse";
    }

    shouldUseOdooAppIcon(app) {
        return this.appIconStyle === "odoo" && !!app.webIconData;
    }

    appThemeIconClass(app) {
        const haystack = [
            app.name,
            app.xmlid,
            app.actionPath,
            app.appID,
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
        const found = THEME_APP_ICONS.find(({ match }) =>
            match.some((token) => haystack.includes(token))
        );
        return `fa ${found?.icon || DEFAULT_APP_ICON}`;
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

    async toggleApp(app, ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        const id = app.id;
        const hasChildren = this.hasAppTreeChildren(app);
        const isTodo = app.xmlid === 'project_todo.menu_todo_backend' || app.name === 'To-do';

        if (isTodo && app.actionID) {
            // To-do app specifically navigates directly
            await this.menuService.selectMenu(app);
        } else if (hasChildren) {
            // Priority: Expand/Collapse for apps with sub-menus (e.g. Sales)
            const next = !this.state.expandedApps[id];
            this.state.expandedApps = { ...this.state.expandedApps, [id]: next };
            if (next) {
                setTimeout(() => {
                    try {
                        const el = document.querySelector(`[data-app-id="${id}"]`);
                        if (el && el.scrollIntoView) {
                            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        }
                    } catch (e) { /* ignore */ }
                }, 150);
            }
        } else if (app.actionID) {
            // Fallback: Navigate for single-action apps with no children
            await this.menuService.selectMenu(app);
        }
    }

    async onNarrowAppWithoutChildren(app, ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        if (app.actionID) {
            await this.menuService.selectMenu(app);
        }
    }

    /** Props for {@link PulseSidebarNarrowFlyoutMenu} (QWeb-friendly). */
    narrowFlyoutMenuProps(app) {
        return { app, sidebar: this };
    }

    isNodeExpanded(menu) {
        return !!this.state.expandedNodes[menu.id];
    }

    async toggleNode(menu, ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        const id = menu.id;
        const hasChildren = this.hasMenuBranches(menu);
        
        if (hasChildren) {
            const next = !this.state.expandedNodes[id];
            this.state.expandedNodes = { ...this.state.expandedNodes, [id]: next };
            if (next) {
                setTimeout(() => {
                    try {
                        const el = document.querySelector(`[data-menu-id="${id}"]`);
                        if (el && el.scrollIntoView) {
                            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        }
                    } catch (e) { /* ignore */ }
                }, 150);
            }
        } else if (menu.actionID) {
            await this.onMenuLeafClick(menu, ev);
        }
    }

    closeMobileSidebar(ev) {
        ev?.preventDefault?.();
        document.body.classList.remove('o_pulse_sidebar_mobile_open');
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
        return ctrl?.action?.tag === "pulse_dashboard";
    }

    async onDashboardClick(ev) {
        ev.preventDefault();
        this.state.sidebarLeafId = null;
        await this.actionService.doAction("web_pulse_theme.action_pulse_dashboard");
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

    onLogoutClick(ev) {
        ev.preventDefault();
        browser.location.href = "/web/session/logout";
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
