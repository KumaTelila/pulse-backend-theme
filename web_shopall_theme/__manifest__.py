# -*- coding: utf-8 -*-
{
    "name": "Shopall Backend Theme",
    "version": "19.0.1.0.5",
    "category": "Theme/Backend",
    "summary": "Dashboard-style backend shell: sidebar apps, two-row navbar, accent colors",
    "depends": ["web", "mail"],
    "license": "LGPL-3",
    "installable": True,
    "application": False,
    "auto_install": False,
    "data": [
        "security/ir.model.access.csv",
        "views/shopall_theme_menu_cleanup.xml",
        "views/shopall_theme_settings_views.xml",
        "views/shopall_auth_templates.xml",
        "views/shopall_dashboard_action.xml",
    ],
    "assets": {
        "web._assets_primary_variables": [
            "web_shopall_theme/static/src/scss/shopall_primary.variables.scss",
            "web_shopall_theme/static/src/scss/shopall_navbar.variables.scss",
        ],
        "web.assets_frontend": [
            "web_shopall_theme/static/src/scss/shopall_auth.scss",
        ],
        # Patches and QWeb must stay in assets_backend so they execute before web/static/src/main.js.
        "web.assets_backend": [
            "/web/static/lib/Chart/Chart.js",
            "web_shopall_theme/static/src/scss/shopall_shell.scss",
            "web_shopall_theme/static/src/scss/shopall_layout.scss",
            "web_shopall_theme/static/src/scss/shopall_dynamic.scss",
            "web_shopall_theme/static/src/scss/shopall_dashboard.scss",
            "web_shopall_theme/static/src/shell/shopall_sidebar.xml",
            "web_shopall_theme/static/src/shell/shopall_navbar.xml",
            "web_shopall_theme/static/src/shell/shopall_mail_systray.xml",
            "web_shopall_theme/static/src/shell/shopall_webclient.xml",
            "web_shopall_theme/static/src/shell/shopall_sidebar.js",
            "web_shopall_theme/static/src/shell/patch_webclient.js",
            "web_shopall_theme/static/src/shell/patch_navbar.js",
            "web_shopall_theme/static/src/theme/shopall_theme_service.js",
            "web_shopall_theme/static/src/theme/shopall_theme_systray.xml",
            "web_shopall_theme/static/src/theme/shopall_theme_systray.js",
            "web_shopall_theme/static/src/dashboard/shopall_dashboard.xml",
            "web_shopall_theme/static/src/dashboard/shopall_dashboard.js",
        ],
    },
}
