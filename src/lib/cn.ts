import { createCn } from "cn/config";

/**
 * The app's `cn`, with the brand type scale (src/app/brand/tailwind.css) registered as font sizes.
 * The stock `cn` reads `text-title`, `text-caption`… as colours and drops them next to `text-foreground`.
 * Import it from "@/lib/cn", never from the bare "cn" package.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "caption",
            "label",
            "body",
            "body-sm",
            "title",
            "title-sm",
            "title-lg",
            "display",
            "display-sm",
          ],
        },
      ],
    },
  },
});
