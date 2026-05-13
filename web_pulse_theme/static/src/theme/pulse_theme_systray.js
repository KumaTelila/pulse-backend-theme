/** @odoo-module **/

import { Component } from "@odoo/owl";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class PulseThemeSystray extends Component {
    static template = "web_pulse_theme.PulseThemeSystray";
    static components = { Dropdown };
    static props = {};

    setup() {
        this.theme = useService("pulse_theme");
    }

    onPickPreset(hex) {
        this.theme.applyPrimary(hex);
    }

    onReset() {
        this.theme.resetPrimary();
    }
}

registry.category("systray").add(
    "web_pulse_theme.systray",
    { Component: PulseThemeSystray },
    { sequence: 35 }
);
