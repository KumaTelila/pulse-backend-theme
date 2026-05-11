# Part of web_shopall_theme. See LICENSE file for full copyright and licensing details.

import re

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError

_HEX6 = re.compile(r"^#[0-9a-fA-F]{6}$")
_HEX3 = re.compile(r"^#[0-9a-fA-F]{3}$")


def _expand_short_hex(hex_str):
    r, g, b = hex_str[1], hex_str[2], hex_str[3]
    return f"#{r}{r}{g}{g}{b}{b}".lower()


def strict_theme_hex(value):
    """Return normalized #rrggbb or None if *value* is not a valid hex color."""
    if not value or not isinstance(value, str):
        return None
    v = value.strip()
    if not v:
        return None
    if not v.startswith("#"):
        v = f"#{v}"
    if _HEX3.match(v):
        v = _expand_short_hex(v)
    if _HEX6.match(v):
        return v.lower()
    return None


def sanitize_theme_hex(value, default):
    """Return normalized #rrggbb or *default*."""
    ok = strict_theme_hex(value)
    return ok if ok is not None else default


# ir.config_parameter keys + HTML design defaults — single source of truth
SHOPALL_THEME_ICP_DEFAULTS = (
    ("web_shopall_theme.primary_color", "#5b4fec"),
    ("web_shopall_theme.text_color", "#1a1a2e"),
    ("web_shopall_theme.muted_color", "#6b7280"),
    ("web_shopall_theme.canvas_color", "#f4f5f7"),
    ("web_shopall_theme.border_color", "#eaecf0"),
)

SHOPALL_THEME_APP_ICON_STYLE_DEFAULT = "shopall"
SHOPALL_THEME_APP_ICON_STYLES = ("shopall", "odoo")


def shopall_theme_icp_session_key(icp_key):
    """web_shopall_theme.primary_color -> primary"""
    short = icp_key.split(".")[-1]
    return short.replace("_color", "") if short.endswith("_color") else short


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    shopall_theme_primary = fields.Char(
        string="Primary accent",
        help="Main brand color: sidebar highlights, primary buttons, tabs (design: --primary).",
        default="#5b4fec",
        config_parameter="web_shopall_theme.primary_color",
    )
    shopall_theme_text = fields.Char(
        string="Main text",
        help="Primary text color (design: --text).",
        default="#1a1a2e",
        config_parameter="web_shopall_theme.text_color",
    )
    shopall_theme_muted = fields.Char(
        string="Muted text",
        help="Secondary labels and nav leaf color (design: --text-muted).",
        default="#6b7280",
        config_parameter="web_shopall_theme.muted_color",
    )
    shopall_theme_canvas = fields.Char(
        string="Background",
        help="App canvas / page background (design: --bg).",
        default="#f4f5f7",
        config_parameter="web_shopall_theme.canvas_color",
    )
    shopall_theme_border = fields.Char(
        string="Borders",
        help="Dividers and light borders.",
        default="#eaecf0",
        config_parameter="web_shopall_theme.border_color",
    )
    shopall_theme_app_icon_style = fields.Selection(
        [
            ("shopall", "Shopall theme icons"),
            ("odoo", "Default Odoo icons"),
        ],
        string="App icons",
        help="Choose whether sidebar app icons use the Shopall theme icon set or each app's default Odoo icon.",
        default=SHOPALL_THEME_APP_ICON_STYLE_DEFAULT,
        config_parameter="web_shopall_theme.app_icon_style",
    )

    _THEME_FIELDS = (
        "shopall_theme_primary",
        "shopall_theme_text",
        "shopall_theme_muted",
        "shopall_theme_canvas",
        "shopall_theme_border",
    )

    @api.constrains(*_THEME_FIELDS)
    def _check_shopall_theme_hex(self):
        labels = {
            "shopall_theme_primary": "Primary accent",
            "shopall_theme_text": "Main text",
            "shopall_theme_muted": "Muted text",
            "shopall_theme_canvas": "Background",
            "shopall_theme_border": "Borders",
        }
        for rec in self:
            for fname in self._THEME_FIELDS:
                raw = getattr(rec, fname)
                if raw and strict_theme_hex(raw) is None:
                    raise ValidationError(
                        _(
                            "%(label)s must be a valid CSS hex color (e.g. #5b4fec).",
                            label=labels[fname],
                        )
                    )

    def set_values(self):
        super().set_values()
        icp = self.env["ir.config_parameter"].sudo()
        for param, default in SHOPALL_THEME_ICP_DEFAULTS:
            cur = icp.get_param(param, default)
            icp.set_param(param, sanitize_theme_hex(cur, default))
        icon_style = icp.get_param(
            "web_shopall_theme.app_icon_style",
            SHOPALL_THEME_APP_ICON_STYLE_DEFAULT,
        )
        if icon_style not in SHOPALL_THEME_APP_ICON_STYLES:
            icp.set_param(
                "web_shopall_theme.app_icon_style",
                SHOPALL_THEME_APP_ICON_STYLE_DEFAULT,
            )

    def action_shopall_theme_reset_defaults(self):
        """Restore design-default colors in ir.config_parameter and reload the UI."""
        self.ensure_one()
        icp = self.env["ir.config_parameter"].sudo()
        for param, value in SHOPALL_THEME_ICP_DEFAULTS:
            icp.set_param(param, value)
        icp.set_param(
            "web_shopall_theme.app_icon_style",
            SHOPALL_THEME_APP_ICON_STYLE_DEFAULT,
        )
        return {
            "type": "ir.actions.client",
            "tag": "soft_reload",
        }
