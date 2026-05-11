/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { NavBar } from "@web/webclient/navbar/navbar";

patch(NavBar.prototype, {
    setup() {
        super.setup();
        this.commandService = useService("command");
    },

    openCommandPalette() {
        this.commandService.openMainPalette();
    },

    /**
     * With a fixed sidebar, section tabs are horizontally scrolled instead of collapsing into “More”.
     */
    async adapt() {
        if (!this.root.el) {
            return;
        }
        const sectionsMenu = this.appSubMenus.el;
        if (!sectionsMenu) {
            return;
        }
        const hadExtra = this.currentAppSectionsExtra.length > 0;
        const sections = [
            ...sectionsMenu.querySelectorAll(":scope > *:not(.o_menu_sections_more)"),
        ];
        for (const section of sections) {
            section.classList.remove("d-none");
        }
        this.currentAppSectionsExtra = [];
        if (hadExtra) {
            return this.render();
        }
    },
});
