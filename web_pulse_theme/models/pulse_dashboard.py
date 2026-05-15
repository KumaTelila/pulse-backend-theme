# Part of web_pulse_theme. See LICENSE file for full copyright and licensing details.

from datetime import timedelta

from odoo import api, fields, models


def _pct_delta(current, previous):
    if not previous and not current:
        return None
    if not previous:
        return 100.0
    return round((current - previous) / previous * 100, 1)


class PulseDashboard(models.TransientModel):
    _name = "pulse.dashboard"
    _description = "Pulse theme dashboard"

    @api.model
    def _sale_installed(self):
        return bool(
            self.env["ir.module.module"]
            .sudo()
            .search([("name", "=", "sale"), ("state", "=", "installed")], limit=1)
        )

    @api.model
    def _period_bounds(self, period_days=30):
        days = max(1, min(365, int(period_days or 30)))
        end = fields.Datetime.now()
        start = end - timedelta(days=days)
        prev_end = start
        prev_start = prev_end - timedelta(days=days)
        return start, end, prev_start, prev_end

    @api.model
    def _base_sale_domain(self, start, end, states):
        return [
            ("date_order", ">=", start),
            ("date_order", "<=", end),
            ("state", "in", states),
        ]

    @api.model
    def _table_tab_domain(self, tab, start, end):
        base_date = [
            ("date_order", ">=", start),
            ("date_order", "<=", end),
        ]
        if tab == "completed":
            return base_date + [("state", "in", ("sale", "done"))]
        if tab == "in_progress":
            return base_date + [("state", "=", "sent")]
        if tab == "pending":
            return base_date + [("state", "=", "draft")]
        if tab == "cancelled":
            return base_date + [("state", "=", "cancel")]
        return base_date

    @api.model
    def _sale_order_row(self, order):
        line = order.order_line[:1]
        product = line.product_id
        categ_name = product.categ_id.name if product and product.categ_id else ""
        product_name = product.display_name if product else ""
        partner = order.partner_id
        return {
            "id": order.id,
            "name": order.name,
            "partner_name": partner.display_name or "",
            "date_order": fields.Datetime.to_string(order.date_order)
            if order.date_order
            else "",
            "amount_total": order.amount_total,
            "category": categ_name,
            "product_name": product_name or order.name,
            "city": partner.city or "",
            "state": order.state,
        }

    @api.model
    def _fill_daily_series(self, start, end, raw_map):
        labels = []
        vals = []
        day = start.date()
        end_day = end.date()
        while day <= end_day:
            labels.append(day.isoformat())
            vals.append(raw_map.get(day, 0.0))
            day += timedelta(days=1)
        return labels, vals

    @api.model
    def _readable_model(self, model_name):
        try:
            Model = self.env[model_name]
        except KeyError:
            return None
        try:
            Model.check_access("read")
        except Exception:
            return None
        return Model

    @api.model
    def _model_exists(self, model_name):
        try:
            self.env[model_name]
        except KeyError:
            return False
        return True

    @api.model
    def _safe_count(self, model_name, domain):
        Model = self._readable_model(model_name)
        if Model is None:
            return 0
        try:
            return Model.search_count(domain)
        except Exception:
            return 0

    @api.model
    def _safe_sum(self, model_name, domain, field_name):
        Model = self._readable_model(model_name)
        if Model is None or field_name not in Model._fields:
            return 0.0
        try:
            rows = Model._read_group(domain, [], [f"{field_name}:sum"])
        except Exception:
            return 0.0
        return float(rows[0][0] or 0.0) if rows else 0.0

    @api.model
    def _module_payload(self, key, label, icon, metrics, bars):
        max_value = max([bar["value"] for bar in bars] or [0])
        for bar in bars:
            bar["percent"] = round((bar["value"] / max_value) * 100, 1) if max_value else 0
        return {
            "key": key,
            "label": label,
            "icon": icon,
            "metrics": metrics,
            "bars": bars,
        }

    @api.model
    def _get_module_overviews(self, start, end):
        overviews = []

        if self._model_exists("sale.order"):
            sales_domain = self._base_sale_domain(start, end, ("sale", "done"))
            quotation_domain = self._base_sale_domain(start, end, ("draft", "sent"))
            revenue = self._safe_sum("sale.order", sales_domain, "amount_total")
            order_count = self._safe_count("sale.order", sales_domain)
            overviews.append(
                self._module_payload(
                    "sales",
                    "Sales",
                    "fa-shopping-bag",
                    [
                        {"label": "Revenue", "value": revenue, "type": "money"},
                        {"label": "Orders", "value": order_count, "type": "number"},
                        {
                            "label": "Quotations",
                            "value": self._safe_count("sale.order", quotation_domain),
                            "type": "number",
                        },
                        {
                            "label": "Average Order",
                            "value": revenue / order_count if order_count else 0.0,
                            "type": "money",
                        },
                    ],
                    [
                        {"label": "Confirmed", "value": order_count},
                        {"label": "Quotations", "value": self._safe_count("sale.order", quotation_domain)},
                        {
                            "label": "Cancelled",
                            "value": self._safe_count(
                                "sale.order",
                                self._base_sale_domain(start, end, ("cancel",)),
                            ),
                        },
                    ],
                )
            )

        Lead = self.env["crm.lead"] if self._model_exists("crm.lead") else None
        if Lead:
            created_domain = [("create_date", ">=", start), ("create_date", "<=", end)]
            opportunity_domain = created_domain
            if "type" in Lead._fields:
                opportunity_domain += [("type", "=", "opportunity")]
            won_domain = opportunity_domain
            if (
                "stage_id" in Lead._fields
                and self._model_exists("crm.stage")
                and "is_won" in self.env["crm.stage"]._fields
            ):
                won_domain += [("stage_id.is_won", "=", True)]
            expected = self._safe_sum("crm.lead", opportunity_domain, "expected_revenue")
            overviews.append(
                self._module_payload(
                    "crm",
                    "CRM",
                    "fa-handshake-o",
                    [
                        {"label": "Leads", "value": self._safe_count("crm.lead", created_domain), "type": "number"},
                        {"label": "Opportunities", "value": self._safe_count("crm.lead", opportunity_domain), "type": "number"},
                        {"label": "Won", "value": self._safe_count("crm.lead", won_domain), "type": "number"},
                        {"label": "Expected", "value": expected, "type": "money"},
                    ],
                    [
                        {"label": "Leads", "value": self._safe_count("crm.lead", created_domain)},
                        {"label": "Opportunities", "value": self._safe_count("crm.lead", opportunity_domain)},
                        {"label": "Won", "value": self._safe_count("crm.lead", won_domain)},
                    ],
                )
            )

        if self._model_exists("purchase.order"):
            date_domain = [("date_order", ">=", start), ("date_order", "<=", end)]
            rfq_domain = date_domain + [("state", "in", ("draft", "sent", "to approve"))]
            po_domain = date_domain + [("state", "in", ("purchase", "done"))]
            total = self._safe_sum("purchase.order", po_domain, "amount_total")
            overviews.append(
                self._module_payload(
                    "purchase",
                    "Purchase",
                    "fa-credit-card",
                    [
                        {"label": "Spend", "value": total, "type": "money"},
                        {"label": "Purchase Orders", "value": self._safe_count("purchase.order", po_domain), "type": "number"},
                        {"label": "RFQs", "value": self._safe_count("purchase.order", rfq_domain), "type": "number"},
                        {"label": "Cancelled", "value": self._safe_count("purchase.order", date_domain + [("state", "=", "cancel")]), "type": "number"},
                    ],
                    [
                        {"label": "POs", "value": self._safe_count("purchase.order", po_domain)},
                        {"label": "RFQs", "value": self._safe_count("purchase.order", rfq_domain)},
                        {"label": "Cancelled", "value": self._safe_count("purchase.order", date_domain + [("state", "=", "cancel")])},
                    ],
                )
            )

        if self._model_exists("stock.picking"):
            date_domain = [("create_date", ">=", start), ("create_date", "<=", end)]
            overviews.append(
                self._module_payload(
                    "inventory",
                    "Inventory",
                    "fa-cubes",
                    [
                        {"label": "Transfers", "value": self._safe_count("stock.picking", date_domain), "type": "number"},
                        {"label": "Ready", "value": self._safe_count("stock.picking", date_domain + [("state", "=", "assigned")]), "type": "number"},
                        {"label": "Done", "value": self._safe_count("stock.picking", date_domain + [("state", "=", "done")]), "type": "number"},
                        {"label": "Waiting", "value": self._safe_count("stock.picking", date_domain + [("state", "in", ("waiting", "confirmed"))]), "type": "number"},
                    ],
                    [
                        {"label": "Ready", "value": self._safe_count("stock.picking", date_domain + [("state", "=", "assigned")])},
                        {"label": "Done", "value": self._safe_count("stock.picking", date_domain + [("state", "=", "done")])},
                        {"label": "Waiting", "value": self._safe_count("stock.picking", date_domain + [("state", "in", ("waiting", "confirmed"))])},
                    ],
                )
            )

        if self._model_exists("account.move"):
            date_domain = [("invoice_date", ">=", start.date()), ("invoice_date", "<=", end.date())]
            invoice_domain = date_domain + [("move_type", "=", "out_invoice")]
            bill_domain = date_domain + [("move_type", "=", "in_invoice")]
            posted_invoice_domain = invoice_domain + [("state", "=", "posted")]
            overviews.append(
                self._module_payload(
                    "accounting",
                    "Accounting",
                    "fa-calculator",
                    [
                        {"label": "Invoiced", "value": self._safe_sum("account.move", posted_invoice_domain, "amount_total_signed"), "type": "money"},
                        {"label": "Customer Invoices", "value": self._safe_count("account.move", invoice_domain), "type": "number"},
                        {"label": "Vendor Bills", "value": self._safe_count("account.move", bill_domain), "type": "number"},
                        {"label": "Drafts", "value": self._safe_count("account.move", date_domain + [("state", "=", "draft")]), "type": "number"},
                    ],
                    [
                        {"label": "Posted", "value": self._safe_count("account.move", posted_invoice_domain)},
                        {"label": "Invoices", "value": self._safe_count("account.move", invoice_domain)},
                        {"label": "Bills", "value": self._safe_count("account.move", bill_domain)},
                    ],
                )
            )

        if self._model_exists("hr.employee"):
            employee_domain = [("active", "=", True)] if "active" in self.env["hr.employee"]._fields else []
            overviews.append(
                self._module_payload(
                    "employees",
                    "Employees",
                    "fa-users",
                    [
                        {"label": "Employees", "value": self._safe_count("hr.employee", employee_domain), "type": "number"},
                        {"label": "New Profiles", "value": self._safe_count("hr.employee", [("create_date", ">=", start), ("create_date", "<=", end)]), "type": "number"},
                        {"label": "Departments", "value": self._safe_count("hr.department", []), "type": "number"},
                        {"label": "Jobs", "value": self._safe_count("hr.job", []), "type": "number"},
                    ],
                    [
                        {"label": "Employees", "value": self._safe_count("hr.employee", employee_domain)},
                        {"label": "Departments", "value": self._safe_count("hr.department", [])},
                        {"label": "Jobs", "value": self._safe_count("hr.job", [])},
                    ],
                )
            )

        if self._model_exists("project.task"):
            date_domain = [("create_date", ">=", start), ("create_date", "<=", end)]
            done_domain = date_domain
            if "stage_id" in self.env["project.task"]._fields:
                done_domain += [("stage_id.fold", "=", True)]
            overviews.append(
                self._module_payload(
                    "project",
                    "Project",
                    "fa-tasks",
                    [
                        {"label": "New Tasks", "value": self._safe_count("project.task", date_domain), "type": "number"},
                        {"label": "Done", "value": self._safe_count("project.task", done_domain), "type": "number"},
                        {"label": "Projects", "value": self._safe_count("project.project", []), "type": "number"},
                        {"label": "Open Tasks", "value": self._safe_count("project.task", [("stage_id.fold", "=", False)]), "type": "number"},
                    ],
                    [
                        {"label": "New", "value": self._safe_count("project.task", date_domain)},
                        {"label": "Done", "value": self._safe_count("project.task", done_domain)},
                        {"label": "Open", "value": self._safe_count("project.task", [("stage_id.fold", "=", False)])},
                    ],
                )
            )

        return overviews

    @api.model
    def get_data(self, tab="all", table_page=1, page_size=8, period_days=30):
        """JSON payload for the Pulse dashboard client action."""
        company = self.env.company
        currency = company.currency_id
        period_days = max(1, min(365, int(period_days or 30)))
        start, end, prev_start, prev_end = self._period_bounds(period_days)
        sale_ok = self._sale_installed()
        module_overviews = self._get_module_overviews(start, end)

        empty = {
            "sale_installed": sale_ok,
            "currency_id": currency.id,
            "period_days": period_days,
            "module_overviews": module_overviews,
            "metrics": {
                "revenue": 0.0,
                "revenue_prev": 0.0,
                "revenue_delta_pct": None,
                "total_sales_qty": 0.0,
                "total_sales_qty_prev": 0.0,
                "total_sales_qty_delta_pct": None,
                "order_count": 0,
                "order_count_prev": 0,
                "order_count_delta_pct": None,
                "profit": 0.0,
                "profit_prev": 0.0,
                "profit_delta_pct": None,
                "has_profit": False,
            },
            "charts": {
                "bar_labels": [],
                "bar_values": [],
                "line_labels": [],
                "line_values": [],
            },
            "chart_stats": {
                "bar_total": 0,
                "bar_delta_pct": None,
                "line_total": 0.0,
                "line_delta_pct": None,
            },
            "table": {
                "rows": [],
                "total": 0,
                "page": max(1, int(table_page or 1)),
                "page_size": max(1, min(50, int(page_size or 8))),
                "tab": tab or "all",
            },
            "pending_tab_count": 0,
        }

        if not sale_ok:
            return empty

        Order = self.env["sale.order"]
        Order.check_access("read")
        self.env["sale.order.line"].check_access("read")

        kpi_states = ("sale", "done")
        kpi_domain_cur = self._base_sale_domain(start, end, kpi_states)
        kpi_domain_prev = self._base_sale_domain(prev_start, prev_end, kpi_states)

        rows_rev_c = Order._read_group(kpi_domain_cur, [], ["amount_total:sum"])
        rows_rev_p = Order._read_group(kpi_domain_prev, [], ["amount_total:sum"])
        rev_c = float(rows_rev_c[0][0] or 0.0) if rows_rev_c else 0.0
        rev_p = float(rows_rev_p[0][0] or 0.0) if rows_rev_p else 0.0

        oc_cur = Order.search_count(kpi_domain_cur)
        oc_prev = Order.search_count(kpi_domain_prev)

        Line = self.env["sale.order.line"]
        qty_g_cur = Line._read_group(
            [
                ("order_id.state", "in", kpi_states),
                ("order_id.date_order", ">=", start),
                ("order_id.date_order", "<=", end),
            ],
            [],
            ["product_uom_qty:sum"],
        )
        qty_g_prev = Line._read_group(
            [
                ("order_id.state", "in", kpi_states),
                ("order_id.date_order", ">=", prev_start),
                ("order_id.date_order", "<=", prev_end),
            ],
            [],
            ["product_uom_qty:sum"],
        )
        qty_cur = float(qty_g_cur[0][0] or 0.0) if qty_g_cur else 0.0
        qty_prev = float(qty_g_prev[0][0] or 0.0) if qty_g_prev else 0.0

        has_margin = "margin" in Order._fields
        profit_c = profit_p = 0.0
        if has_margin:
            m_c = Order._read_group(kpi_domain_cur, [], ["margin:sum"])
            m_p = Order._read_group(kpi_domain_prev, [], ["margin:sum"])
            profit_c = float(m_c[0][0] or 0.0) if m_c else 0.0
            profit_p = float(m_p[0][0] or 0.0) if m_p else 0.0

        chart_states = ("sale", "done")
        chart_domain = self._base_sale_domain(start, end, chart_states)
        bar_groups = Order._read_group(
            chart_domain,
            ["date_order:day"],
            ["__count"],
        )
        bar_map = {}
        for row in bar_groups:
            day_val, count = row
            if day_val:
                d = day_val.date() if hasattr(day_val, "date") else day_val
                bar_map[d] = float(count or 0)
        bar_labels, bar_values = self._fill_daily_series(start, end, bar_map)
        bar_total_cur = sum(bar_values)

        line_groups = Order._read_group(
            chart_domain,
            ["date_order:day"],
            ["amount_total:sum"],
        )
        line_map = {}
        for row in line_groups:
            day_val, amount_sum = row
            if day_val:
                d = day_val.date() if hasattr(day_val, "date") else day_val
                line_map[d] = float(amount_sum or 0.0)
        line_labels, line_values = self._fill_daily_series(start, end, line_map)
        line_total_cur = sum(line_values)

        prev_chart_domain = self._base_sale_domain(prev_start, prev_end, chart_states)
        prev_bar_groups = Order._read_group(
            prev_chart_domain,
            ["date_order:day"],
            ["__count"],
        )
        bar_prev_total = sum(float(row[1] or 0) for row in prev_bar_groups)
        prev_line_groups = Order._read_group(
            prev_chart_domain,
            ["date_order:day"],
            ["amount_total:sum"],
        )
        line_prev_total = sum(float(row[1] or 0) for row in prev_line_groups)

        tab_domain = self._table_tab_domain(tab, start, end)
        page = max(1, int(table_page or 1))
        limit = max(1, min(50, int(page_size or 8)))
        total_rows = Order.search_count(tab_domain)
        offset = (page - 1) * limit
        orders = Order.search(
            tab_domain, limit=limit, offset=offset, order="date_order desc"
        )

        rows = [self._sale_order_row(order) for order in orders]

        pending_tab_count = Order.search_count(
            [
                ("date_order", ">=", start),
                ("date_order", "<=", end),
                ("state", "=", "draft"),
            ]
        )

        return {
            "sale_installed": True,
            "currency_id": currency.id,
            "period_days": period_days,
            "metrics": {
                "revenue": rev_c,
                "revenue_prev": rev_p,
                "revenue_delta_pct": _pct_delta(rev_c, rev_p),
                "total_sales_qty": qty_cur,
                "total_sales_qty_prev": qty_prev,
                "total_sales_qty_delta_pct": _pct_delta(qty_cur, qty_prev),
                "order_count": oc_cur,
                "order_count_prev": oc_prev,
                "order_count_delta_pct": _pct_delta(oc_cur, oc_prev),
                "profit": profit_c if has_margin else 0.0,
                "profit_prev": profit_p if has_margin else 0.0,
                "profit_delta_pct": _pct_delta(profit_c, profit_p)
                if has_margin
                else None,
                "has_profit": has_margin,
            },
            "charts": {
                "bar_labels": bar_labels,
                "bar_values": bar_values,
                "line_labels": line_labels,
                "line_values": line_values,
            },
            "chart_stats": {
                "bar_total": int(bar_total_cur),
                "bar_delta_pct": _pct_delta(bar_total_cur, bar_prev_total),
                "line_total": line_total_cur,
                "line_delta_pct": _pct_delta(line_total_cur, line_prev_total),
            },
            "module_overviews": module_overviews,
            "table": {
                "rows": rows,
                "total": total_rows,
                "page": page,
                "page_size": limit,
                "tab": tab or "all",
            },
            "pending_tab_count": pending_tab_count,
        }

    @api.model
    def export_sales(self, tab="all", period_days=30, limit=5000):
        """Rows for the dashboard CSV export, using the same period/status filters."""
        if not self._sale_installed():
            return {"filename": "pulse-sales.csv", "headers": [], "rows": []}
        period_days = max(1, min(365, int(period_days or 30)))
        start, end, _prev_start, _prev_end = self._period_bounds(period_days)
        Order = self.env["sale.order"]
        Order.check_access("read")
        domain = self._table_tab_domain(tab, start, end)
        orders = Order.search(
            domain,
            limit=max(1, min(10000, int(limit or 5000))),
            order="date_order desc",
        )
        rows = []
        for order in orders:
            row = self._sale_order_row(order)
            rows.append(
                [
                    row["name"],
                    row["partner_name"],
                    row["date_order"],
                    row["amount_total"],
                    row["category"],
                    row["product_name"],
                    row["city"],
                    row["state"],
                ]
            )
        return {
            "filename": f"pulse-sales-{tab or 'all'}-{period_days}d.csv",
            "headers": [
                "Order",
                "Client Name",
                "Date",
                "Price",
                "Category",
                "Product",
                "City",
                "Status",
            ],
            "rows": rows,
        }
