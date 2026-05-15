# -*- coding: utf-8 -*-
{
    "name": "Pulse Backend Theme(Community Version)",
    "version": "18.0.1.0.5",
    "summary": "Dashboard-style backend shell: sidebar apps, two-row navbar, accent colors",
    "description": """
Pulse Backend Theme transforms the default Odoo interface into a modern, dashboard-style experience.
Key features include a persistent vertical apps sidebar, a redesigned two-row navbar, and fully customizable accent colors.
    """,
    "category": "Theme/Backend",
    "author": "Kuma Telila",
    "maintainer": "Beineto",
    "website": "https://www.linkedin.com/in/kumatelila/",
    "support": "kumatelila26@gmail.com",
    "license": "OPL-1",
    "price": 45.00,
    "currency": "USD",
    'live_test_url' : 'http://37.60.243.252:8076/',
     'images': [
        'static/description/banner.png',
        'static/description/theme_screenshot.png',
    ],
    "depends": ["web", "mail"],
    "installable": True,
    "application": True,
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
            "web_pulse_theme/static/src/dashboard/pulse_dashboard.xml",
            "web_pulse_theme/static/src/dashboard/pulse_dashboard.js",
        ],
    },
}
