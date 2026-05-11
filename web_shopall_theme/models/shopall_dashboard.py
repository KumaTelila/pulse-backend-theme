# Part of web_shopall_theme. See LICENSE file for full copyright and licensing details.

from datetime import timedelta

from odoo import api, fields, models


def _pct_delta(current, previous):
    if not previous and not current:
        return None
    if not previous:
        return 100.0
    return round((current - previous) / previous * 100, 1)


class ShopallDashboard(models.TransientModel):
    _name = "shopall.dashboard"
    _description = "Shopall theme dashboard"

    @api.model
    def _sale_installed(self):
        return bool(
            self.env["ir.module.module"]
            .sudo()
            .search([("name", "=", "sale"), ("state", "=", "installed")], limit=1)
        )

    @api.model
    def _period_bounds(self):
        end = fields.Datetime.now()
        start = end - timedelta(days=30)
        prev_end = start
        prev_start = prev_end - timedelta(days=30)
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
    def get_data(self, tab="all", table_page=1, page_size=8):
        """JSON payload for the Shopall dashboard client action."""
        company = self.env.company
        currency = company.currency_id
        start, end, prev_start, prev_end = self._period_bounds()
        sale_ok = self._sale_installed()

        empty = {
            "sale_installed": sale_ok,
            "currency_id": currency.id,
            "period_days": 30,
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
        for day_val, count in bar_groups:
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
        for day_val, amount_sum in line_groups:
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
        bar_prev_total = sum(float(c or 0) for _d, c in prev_bar_groups)
        prev_line_groups = Order._read_group(
            prev_chart_domain,
            ["date_order:day"],
            ["amount_total:sum"],
        )
        line_prev_total = sum(float(a or 0) for _d, a in prev_line_groups)

        tab_domain = self._table_tab_domain(tab, start, end)
        page = max(1, int(table_page or 1))
        limit = max(1, min(50, int(page_size or 8)))
        total_rows = Order.search_count(tab_domain)
        offset = (page - 1) * limit
        orders = Order.search(
            tab_domain, limit=limit, offset=offset, order="date_order desc"
        )

        rows = []
        for order in orders:
            line = order.order_line[:1]
            product = line.product_id
            categ_name = product.categ_id.name if product and product.categ_id else ""
            product_name = product.display_name if product else ""
            partner = order.partner_id
            city = partner.city or ""
            rows.append(
                {
                    "id": order.id,
                    "name": order.name,
                    "partner_name": partner.display_name or "",
                    "date_order": fields.Datetime.to_string(order.date_order)
                    if order.date_order
                    else "",
                    "amount_total": order.amount_total,
                    "category": categ_name,
                    "product_name": product_name or order.name,
                    "city": city,
                    "state": order.state,
                }
            )

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
            "period_days": 30,
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
            "table": {
                "rows": rows,
                "total": total_rows,
                "page": page,
                "page_size": limit,
                "tab": tab or "all",
            },
            "pending_tab_count": pending_tab_count,
        }
