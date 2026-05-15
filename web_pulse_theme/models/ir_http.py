# Part of web_pulse_theme. See LICENSE file for full copyright and licensing details.

from odoo import models

from .res_config_settings import (
    PULSE_THEME_APP_ICON_STYLE_DEFAULT,
    PULSE_THEME_APP_ICON_STYLES,
    PULSE_THEME_ICP_DEFAULTS,
    sanitize_theme_hex,
    pulse_theme_icp_session_key,
)


class IrHttp(models.AbstractModel):
    _inherit = "ir.http"

    def _pulse_theme_color_dict(self):
        """Design colors from ir.config_parameter (safe for public/login pages)."""
        icp = self.env["ir.config_parameter"].sudo()
        theme = {
            pulse_theme_icp_session_key(param): sanitize_theme_hex(
                icp.get_param(param, default), default
            )
            for param, default in PULSE_THEME_ICP_DEFAULTS
        }
        icon_style = icp.get_param(
            "web_pulse_theme.app_icon_style",
            PULSE_THEME_APP_ICON_STYLE_DEFAULT,
        )
        theme["app_icon_style"] = (
            icon_style
            if icon_style in PULSE_THEME_APP_ICON_STYLES
            else PULSE_THEME_APP_ICON_STYLE_DEFAULT
        )
        return theme

    def pulse_theme_for_portal(self):
        """Expose theme colors to QWeb (login / signup / reset password)."""
        return self._pulse_theme_color_dict()

    def session_info(self):
        res = super().session_info()
        res["pulse_theme"] = self._pulse_theme_color_dict()
        return res

    def get_frontend_session_info(self):
        res = super().get_frontend_session_info()
        res["pulse_theme"] = self._pulse_theme_color_dict()
        return res
