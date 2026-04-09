"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import type { ReactNode } from "react";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch";

const iconBtnClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 bg-black/70 text-slate-100 shadow-sm backdrop-blur-md transition hover:border-cyan-500/30 hover:bg-cyan-500/15 hover:text-cyan-50";

/**
 * 为偏宽的 Mermaid 流程图提供右上角缩放与拖拽平移（滚轮亦可缩放）。
 */
export function MermaidFlowchartZoom({ children }: { children: ReactNode }) {
  return (
    <TransformWrapper
      initialScale={0.82}
      minScale={0.35}
      maxScale={2.75}
      centerOnInit={false}
      limitToBounds={false}
      wheel={{ step: 0.1 }}
      panning={{ velocityDisabled: true }}
      doubleClick={{ mode: "reset" }}
    >
      {(api: ReactZoomPanPinchContentRef) => (
        <div className="relative">
          <div className="pointer-events-none absolute right-1 top-1 z-20 sm:right-2 sm:top-2">
            <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-white/14 bg-black/80 p-0.5 shadow-lg backdrop-blur-md">
              <button
                type="button"
                className={iconBtnClass}
                aria-label="放大流程图"
                title="放大"
                onClick={() => api.zoomIn(0.18)}
              >
                <ZoomIn className="h-4 w-4" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                className={iconBtnClass}
                aria-label="缩小流程图"
                title="缩小"
                onClick={() => api.zoomOut(0.18)}
              >
                <ZoomOut className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </div>
          </div>
          <TransformComponent
            wrapperClass="!w-full max-h-[min(70vh,640px)] min-h-[220px] overflow-auto rounded-xl border border-white/10 bg-black/25"
            contentClass="inline-block min-w-min origin-top-left p-3 pt-11 sm:p-4 sm:pt-12"
            wrapperStyle={{ touchAction: "none" }}
          >
            {children}
          </TransformComponent>
        </div>
      )}
    </TransformWrapper>
  );
}
