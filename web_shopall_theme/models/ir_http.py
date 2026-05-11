# Part of web_shopall_theme. See LICENSE file for full copyright and licensing details.

from odoo import models

from .res_config_settings import (
    SHOPALL_THEME_APP_ICON_STYLE_DEFAULT,
    SHOPALL_THEME_APP_ICON_STYLES,
    SHOPALL_THEME_ICP_DEFAULTS,
    sanitize_theme_hex,
    shopall_theme_icp_session_key,
)


class IrHttp(models.AbstractModel):
    _inherit = "ir.http"

    def _shopall_theme_color_dict(self):
        """Design colors from ir.config_parameter (safe for public/login pages)."""
        icp = self.env["ir.config_parameter"].sudo()
        theme = {
            shopall_theme_icp_session_key(param): sanitize_theme_hex(
                icp.get_param(param, default), default
            )
            for param, default in SHOPALL_THEME_ICP_DEFAULTS
        }
        icon_style = icp.get_param(
            "web_shopall_theme.app_icon_style",
            SHOPALL_THEME_APP_ICON_STYLE_DEFAULT,
        )
        theme["app_icon_style"] = (
            icon_style
            if icon_style in SHOPALL_THEME_APP_ICON_STYLES
            else SHOPALL_THEME_APP_ICON_STYLE_DEFAULT
        )
        return theme

    def shopall_theme_for_portal(self):
        """Expose theme colors to QWeb (login / signup / reset password)."""
        return self._shopall_theme_color_dict()

    def session_info(self):
        res = super().session_info()
        res["shopall_theme"] = self._shopall_theme_color_dict()
        return res

    def get_frontend_session_info(self):
        res = super().get_frontend_session_info()
        res["shopall_theme"] = self._shopall_theme_color_dict()
        return res
