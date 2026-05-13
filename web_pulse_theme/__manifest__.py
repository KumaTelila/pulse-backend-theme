# -*- coding: utf-8 -*-
{
    "name": "Pulse Backend Theme",
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
        "views/pulse_theme_menu_cleanup.xml",
        "views/pulse_theme_settings_views.xml",
        "views/pulse_auth_templates.xml",
        "views/pulse_dashboard_action.xml",
    ],
    "assets": {
        "web._assets_primary_variables": [
            "web_pulse_theme/static/src/scss/pulse_primary.variables.scss",
            "web_pulse_theme/static/src/scss/pulse_navbar.variables.scss",
        ],
        "web.assets_frontend": [
            "web_pulse_theme/static/src/scss/pulse_auth.scss",
        ],
        # Patches and QWeb must stay in assets_backend so they execute before web/static/src/main.js.
        "web.assets_backend": [
            "/web/static/lib/Chart/Chart.js",
            "web_pulse_theme/static/src/scss/pulse_shell.scss",
            "web_pulse_theme/static/src/scss/pulse_layout.scss",
            "web_pulse_theme/static/src/scss/pulse_dynamic.scss",
            "web_pulse_theme/static/src/scss/pulse_dashboard.scss",
            "web_pulse_theme/static/src/shell/pulse_sidebar.xml",
            "web_pulse_theme/static/src/shell/pulse_navbar.xml",
            "web_pulse_theme/static/src/shell/pulse_mail_systray.xml",
            "web_pulse_theme/static/src/shell/pulse_webclient.xml",
            "web_pulse_theme/static/src/shell/pulse_sidebar.js",
            "web_pulse_theme/static/src/shell/patch_webclient.js",
            "web_pulse_theme/static/src/shell/patch_navbar.js",
            "web_pulse_theme/static/src/theme/pulse_theme_service.js",
            "web_pulse_theme/static/src/theme/pulse_theme_systray.xml",
            "web_pulse_theme/static/src/theme/pulse_theme_systray.js",
            "web_pulse_theme/static/src/dashboard/pulse_dashboard.xml",
            "web_pulse_theme/static/src/dashboard/pulse_dashboard.js",
        ],
    },
}
