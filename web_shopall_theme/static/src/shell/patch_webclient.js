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
    },
});
