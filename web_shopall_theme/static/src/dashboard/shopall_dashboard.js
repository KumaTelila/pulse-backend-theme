/** @odoo-module **/

import { Component, onMounted, onWillStart, onWillUnmount, useRef, useState } from "@odoo/owl";
import { browser } from "@web/core/browser/browser";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { standardActionServiceProps } from "@web/webclient/actions/action_service";
import { formatDateTime, parseDateTime } from "@web/core/l10n/dates";
import { formatFloat, formatMonetary } from "@web/views/fields/formatters";
import { _t } from "@web/core/l10n/translation";

export class ShopallDashboard extends Component {
    static template = "web_shopall_theme.ShopallDashboard";
    static props = { ...standardActionServiceProps };

    setup() {
        this.orm = useService("orm");
        this.actionService = useService("action");
        this.notification = useService("notification");
        this.barCanvasRef = useRef("barCanvas");
        this.lineCanvasRef = useRef("lineCanvas");
        this.charts = { bar: null, line: null };
        this.state = useState({
            loading: true,
            data: null,
            tab: "all",
            page: 1,
            upgradeHidden: browser.localStorage.getItem("shopall_upgrade_banner_dismissed") === "1",
        });
        onWillStart(() => this.load());
        onMounted(() => {
            this.tryDrawCharts();
        });
        onWillUnmount(() => this.destroyCharts());
    }

    async load() {
        this.state.loading = true;
        try {
            const payload = await this.orm.call("shopall.dashboard", "get_data", [], {
                tab: this.state.tab,
                table_page: this.state.page,
                page_size: 8,
            });
            this.state.data = payload;
        } catch (e) {
            console.error(e);
            this.notification.add(_t("Could not load overview data."), { type: "danger" });
            this.state.data = null;
        } finally {
            this.state.loading = false;
        }
        this.tryDrawCharts();
    }

    tryDrawCharts() {
        queueMicrotask(() => this.drawCharts());
    }

    getPrimaryColor() {
        const v = getComputedStyle(document.documentElement)
            .getPropertyValue("--shopall-primary")
            .trim();
        return v || "#5b4fec";
    }

    drawCharts() {
        if (!this.state.data?.charts || typeof window.Chart === "undefined") {
            return;
        }
        const barEl = this.barCanvasRef.el;
        const lineEl = this.lineCanvasRef.el;
        if (!barEl || !lineEl) {
            return;
        }
        const primary = this.getPrimaryColor();
        const { charts } = this.state.data;
        const Chart = window.Chart;

        this.destroyCharts();

        this.charts.bar = new Chart(barEl, {
            type: "bar",
            data: {
                labels: charts.bar_labels.map((iso) => this.shortDateLabel(iso)),
                datasets: [
                    {
                        data: charts.bar_values,
                        backgroundColor: `${primary}99`,
                        borderColor: primary,
                        borderWidth: 1,
                        borderRadius: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } },
                    y: { beginAtZero: true, grid: { color: "#eaecf0" } },
                },
            },
        });

        this.charts.line = new Chart(lineEl, {
            type: "line",
            data: {
                labels: charts.line_labels.map((iso) => this.shortDateLabel(iso)),
                datasets: [
                    {
                        data: charts.line_values,
                        borderColor: primary,
                        backgroundColor: `${primary}22`,
                        fill: true,
                        tension: 0.35,
                        pointRadius: 0,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } },
                    y: { beginAtZero: true, grid: { color: "#eaecf0" } },
                },
            },
        });
    }

    destroyCharts() {
        if (this.charts.bar) {
            this.charts.bar.destroy();
            this.charts.bar = null;
        }
        if (this.charts.line) {
            this.charts.line.destroy();
            this.charts.line = null;
        }
    }

    shortDateLabel(isoDate) {
        if (!isoDate) {
            return "";
        }
        const d = new Date(`${isoDate}T12:00:00`);
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    formatRowDate(serverStr) {
        if (!serverStr) {
            return "";
        }
        try {
            const dt = parseDateTime(serverStr);
            return formatDateTime(dt);
        } catch {
            return serverStr;
        }
    }

    formatMoney(amount) {
        const cid = this.state.data?.currency_id;
        return formatMonetary(amount, { currencyId: cid, noSymbol: false });
    }

    formatQty(q) {
        return formatFloat(q, { digits: [16, 0] });
    }

    metricDeltaClass(pct) {
        if (pct == null) {
            return "";
        }
        return pct >= 0 ? "up" : "down";
    }

    formatDelta(pct) {
        if (pct == null) {
            return _t("n/a vs previous period");
        }
        const sign = pct > 0 ? "+" : "";
        return `${sign}${pct}% ${_t("from previous period")}`;
    }

    async onTabClick(tab) {
        if (this.state.tab === tab) {
            return;
        }
        this.state.tab = tab;
        this.state.page = 1;
        await this.load();
    }

    async onPageChange(nextPage) {
        const t = this.state.data?.table;
        if (!t) {
            return;
        }
        const totalPages = Math.max(1, Math.ceil(t.total / t.page_size));
        const p = Math.min(Math.max(1, nextPage), totalPages);
        if (p === this.state.page) {
            return;
        }
        this.state.page = p;
        await this.load();
    }

    pageNums() {
        const t = this.state.data?.table;
        if (!t?.page_size) {
            return [1];
        }
        const totalPages = Math.max(1, Math.ceil(t.total / t.page_size));
        const cur = t.page;
        const nums = [];
        for (let i = Math.max(1, cur - 2); i <= Math.min(totalPages, cur + 2); i++) {
            nums.push(i);
        }
        return nums.length ? nums : [1];
    }

    rowStatusClass(state) {
        const m = {
            draft: "o_shopall_dash_status_pending",
            sent: "o_shopall_dash_status_inprogress",
            sale: "o_shopall_dash_status_completed",
            done: "o_shopall_dash_status_completed",
            cancel: "o_shopall_dash_status_cancelled",
        };
        return m[state] || "o_shopall_dash_status_inprogress";
    }

    rowStatusLabel(state) {
        const labels = {
            draft: _t("Pending"),
            sent: _t("In Progress"),
            sale: _t("Completed"),
            done: _t("Completed"),
            cancel: _t("Cancelled"),
        };
        return labels[state] || state;
    }

    dismissUpgrade() {
        browser.localStorage.setItem("shopall_upgrade_banner_dismissed", "1");
        this.state.upgradeHidden = true;
    }

    async openSaleOrders() {
        if (!this.state.data?.sale_installed) {
            this.notification.add(_t("Install the Sales app to open orders."), { type: "info" });
            return;
        }
        try {
            await this.actionService.doAction("sale.action_orders");
        } catch {
            await this.saleOrdersFallback();
        }
    }

    async saleOrdersFallback() {
        await this.actionService.doAction({
            type: "ir.actions.act_window",
            name: _t("Sales Orders"),
            res_model: "sale.order",
            view_mode: "list,form",
            views: [
                [false, "list"],
                [false, "form"],
            ],
            target: "current",
        });
    }

    deltaIconClass(pct) {
        if (pct == null) {
            return "fa-minus";
        }
        return pct >= 0 ? "fa-long-arrow-up" : "fa-long-arrow-down";
    }

    lastTablePage() {
        const t = this.state.data?.table;
        if (!t?.page_size) {
            return 1;
        }
        return Math.max(1, Math.ceil(t.total / t.page_size));
    }

    onExportClick() {
        this.openSaleOrders();
    }
}

registry.category("actions").add("shopall_dashboard", ShopallDashboard);
