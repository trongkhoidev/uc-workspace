// Top of the sidebar: the UCTalent logo and name, search, and the sidebar fold button.
import { View, div, image, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, run, window, shared, setShared, layout } from "herdr";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The rail is decided by the sidebar's width, so dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? 268) : window()?.platform === "macos" ? 76 : 44 });
}

export default class Brand extends View {
  button(id, icon, action) {
    const t = theme();
    return div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.muted)
      .hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action).child(svg(`mods/uc-brand/${icon}.svg`).size(15));
  }
  render() {
    const t = theme();
    const collapsed = narrow();
    const mac = window()?.platform === "macos";
    return h_flex().size_full().bg(t.chrome).pl(collapsed ? 6 : 14).pr(10).gap(4).items_center()
      .when(mac && !window()?.fullscreen && !collapsed, el => el.pl(76))
      .when(!collapsed, el => el.child(h_flex().flex_1().gap(9).items_center()
        .child(image("mods/uc-brand/logo.png").size(30).flex_none().rounded_full())
        .child(div().font_semibold().text_size(15).text_color(t.foreground).child("UCTalent"))))
      .when(!collapsed, el => el.child(this.button("search", "search", () => run("mod.open", { name: "picker" }))))
      // On the macOS rail the traffic lights fill the row.
      .when(!(collapsed && mac), el => el.child(this.button("sidebar-toggle", "sidebar", toggleSidebar)));
  }
}
