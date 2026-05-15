/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { WebClient } from "@web/webclient/webclient";
import { PulseSidebar } from "./pulse_sidebar";

patch(WebClient, {
    components: {
        ...WebClient.components,
        PulseSidebar,
    },
});

patch(WebClient.prototype, {
    setup() {
        super.setup();
        document.body.classList.add("o_pulse_theme");

        // Close mobile sidebar when clicking the backdrop or pressing Escape.
        this._pulseBackdropHandler = (ev) => {
            // If click target is the backdrop element (or inside it), close the sidebar.
            try {
                if (ev.target && ev.target.closest && ev.target.closest('.o_pulse_sidebar_backdrop')) {
                    document.body.classList.remove('o_pulse_sidebar_mobile_open');
                }
            } catch (e) {
                // ignore
            }
        };
        this._pulseEscHandler = (ev) => {
            if (ev.key === 'Escape') {
                document.body.classList.remove('o_pulse_sidebar_mobile_open');
            }
        };
        document.addEventListener('click', this._pulseBackdropHandler, { capture: true });
        document.addEventListener('keydown', this._pulseEscHandler);
    },

    _loadDefaultApp() {
        return this.actionService.doAction("web_pulse_theme.action_pulse_dashboard", {
            clearBreadcrumbs: true,
        });
    },
});
