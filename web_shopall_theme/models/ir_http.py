# Part of web_shopall_theme. See LICENSE file for full copyright and licensing details.

from odoo import models

from .res_config_settings import (
    SHOPALL_THEME_ICP_DEFAULTS,
    sanitize_theme_hex,
    shopall_theme_icp_session_key,
)


class IrHttp(models.AbstractModel):
    _inherit = "ir.http"

    def session_info(self):
        res = super().session_info()
        icp = self.env["ir.config_parameter"].sudo()
        res["shopall_theme"] = {
            shopall_theme_icp_session_key(param): sanitize_theme_hex(
                icp.get_param(param, default), default
            )
            for param, default in SHOPALL_THEME_ICP_DEFAULTS
        }
        return res
