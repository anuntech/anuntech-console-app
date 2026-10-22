"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"
import { Tabs as TabsPrimitive } from "radix-ui"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list relative inline-flex w-fit items-center justify-center rounded-full p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/** The active trigger's box, and where its underline sits (the line variant). */
type IndicatorBox = { x: number; y: number; w: number; h: number; line: number }

/**
 * Where the active trigger sits, so one indicator can slide between tabs
 * instead of each trigger swapping its own background. Horizontal lists
 * only; null until measured, and the triggers keep their own active look
 * until then (server render, no JS).
 */
function useActiveTab(ref: React.RefObject<HTMLDivElement | null>) {
  const [box, setBox] = React.useState<IndicatorBox | null>(null)
  const [settled, setSettled] = React.useState(false)
  React.useLayoutEffect(() => {
    const list = ref.current
    if (!list) return
    const measure = () => {
      const active = list.querySelector<HTMLElement>('[data-slot="tabs-trigger"][data-state="active"]')
      if (!active || list.getAttribute("aria-orientation") === "vertical") return setBox(null)
      // The underline is the trigger's ::after; screens may move it (FormSheet puts it at the bottom edge).
      const after = getComputedStyle(active, "::after")
      const line = active.offsetTop + active.offsetHeight - (parseFloat(after.bottom) || 0) - (parseFloat(after.height) || 2)
      const next = { x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight, line }
      setBox((current) =>
        current && current.x === next.x && current.y === next.y && current.w === next.w && current.h === next.h && current.line === next.line
          ? current
          : next
      )
    }
    measure()
    // The first position is placed, not animated; moves after that slide.
    const frame = requestAnimationFrame(() => setSettled(true))
    const states = new MutationObserver(measure)
    states.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-state"] })
    const sizes = new ResizeObserver(measure)
    sizes.observe(list)
    for (const trigger of list.querySelectorAll('[data-slot="tabs-trigger"]')) sizes.observe(trigger)
    return () => {
      cancelAnimationFrame(frame)
      states.disconnect()
      sizes.disconnect()
    }
  }, [ref])
  return { box, settled }
}

function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const ref = React.useRef<HTMLDivElement>(null)
  const { box, settled } = useActiveTab(ref)
  const line = variant === "line"
  return (
    <TabsPrimitive.List
      ref={ref}
      data-slot="tabs-list"
      data-variant={variant}
      data-indicator={box ? "" : undefined}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {box && (
        <span
          aria-hidden="true"
          data-slot="tabs-indicator"
          className={cn(
            "pointer-events-none absolute top-0 left-0 motion-reduce:transition-none",
            settled && "duration-(--anu-motion-base)",
            line
              ? // A 100px bar scaled to the tab: on a 2px line the scale does not show.
                "h-0.5 w-[100px] origin-left bg-foreground transition-transform"
              : "rounded-full bg-background shadow-sm transition-transform dark:border dark:border-input dark:bg-input/30",
            !settled && "transition-none"
          )}
          style={
            line
              ? { transform: `translate(${box.x}px, ${box.line}px) scaleX(${box.w / 100})` }
              : // Only the slide animates (transform); the width takes the new tab's size at once, under the slide.
                { width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)` }
          }
        />
      )}
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-full border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-[color,background-color,border-color,box-shadow] group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        // Once the sliding indicator is measured it draws the active look instead.
        "group-data-indicator/tabs-list:data-[state=active]:border-transparent! group-data-indicator/tabs-list:data-[state=active]:bg-transparent! group-data-indicator/tabs-list:data-[state=active]:shadow-none! group-data-indicator/tabs-list:after:hidden",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
