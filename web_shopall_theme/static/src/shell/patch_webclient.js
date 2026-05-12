/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { WebClient } from "@web/webclient/webclient";
import { ShopallSidebar } from "./shopall_sidebar";

patch(WebClient, {
    components: {
        ...WebClient.components,
        ShopallSidebar,
    },
});

patch(WebClient.prototype, {
    setup() {
        super.setup();
        document.body.classList.add("o_shopall_theme");

        // Close mobile sidebar when clicking the backdrop or pressing Escape.
        this._shopallBackdropHandler = (ev) => {
            // If click target is the backdrop element (or inside it), close the sidebar.
            try {
                if (ev.target && ev.target.closest && ev.target.closest('.o_shopall_sidebar_backdrop')) {
                    document.body.classList.remove('o_shopall_sidebar_mobile_open');
                }
            } catch (e) {
                // ignore
            }
        };
        this._shopallEscHandler = (ev) => {
            if (ev.key === 'Escape') {
                document.body.classList.remove('o_shopall_sidebar_mobile_open');
            }
        };
        document.addEventListener('click', this._shopallBackdropHandler, { capture: true });
        document.addEventListener('keydown', this._shopallEscHandler);
    },

    _loadDefaultApp() {
        return this.actionService.doAction("web_shopall_theme.action_shopall_dashboard", {
            clearBreadcrumbs: true,
        });
    },
});
