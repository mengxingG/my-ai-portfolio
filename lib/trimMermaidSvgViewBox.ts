/**
 * Mermaid mindmap SVGs often have a large viewBox with empty margins.
 * Tighten viewBox to graphic bounds so fit-to-view uses the real diagram size.
 */
export function trimMermaidSvgToContent(svgMarkup: string): string {
  if (typeof document === "undefined" || !svgMarkup.trim()) return svgMarkup;

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;visibility:hidden;pointer-events:none";
  host.innerHTML = svgMarkup;
  document.body.appendChild(host);

  try {
    const el = host.querySelector("svg");
    if (!(el instanceof SVGSVGElement)) return svgMarkup;

    let bb: DOMRect;
    try {
      bb = el.getBBox();
    } catch {
      return svgMarkup;
    }

    if (!Number.isFinite(bb.width) || !Number.isFinite(bb.height) || bb.width < 2 || bb.height < 2) {
      return svgMarkup;
    }

    const pad = Math.max(bb.width, bb.height) * 0.02;
    const vx = bb.x - pad;
    const vy = bb.y - pad;
    const vw = bb.width + pad * 2;
    const vh = bb.height + pad * 2;

    el.setAttribute("viewBox", `${vx} ${vy} ${vw} ${vh}`);
    el.removeAttribute("width");
    el.removeAttribute("height");
    el.removeAttribute("style");
    el.setAttribute("width", String(Math.ceil(vw)));
    el.setAttribute("height", String(Math.ceil(vh)));

    const inner = host.querySelector("svg");
    return inner?.outerHTML ?? svgMarkup;
  } finally {
    host.remove();
  }
}
