/** @odoo-module **/

import { Component } from "@odoo/owl";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class ShopallThemeSystray extends Component {
    static template = "web_shopall_theme.ShopallThemeSystray";
    static components = { Dropdown };
    static props = {};

    setup() {
        this.theme = useService("shopall_theme");
    }

    onPickPreset(hex) {
        this.theme.applyPrimary(hex);
    }

    onReset() {
        this.theme.resetPrimary();
    }
}

registry.category("systray").add(
    "web_shopall_theme.systray",
    { Component: ShopallThemeSystray },
    { sequence: 35 }
);
