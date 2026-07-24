import type { QuartzEmitterPlugin } from "@quartz-community/types";
import { prepareConfig } from "./config.js";
import { renderHtml } from "./html.js";
import { resolveOptions, type SveltiaCmsOptions } from "./options.js";
import { writeArtifacts } from "./write.js";

export const SveltiaCms: QuartzEmitterPlugin<SveltiaCmsOptions> = (options) => {
  const emit = async (
    ctx: Parameters<ReturnType<QuartzEmitterPlugin>["emit"]>[0],
  ) => {
    const resolved = resolveOptions(options);
    const config = await prepareConfig(resolved);
    const html = renderHtml(resolved.title, resolved.scriptUrl);
    return writeArtifacts(ctx.argv.output, resolved.route, html, config);
  };

  return {
    name: "SveltiaCms",
    emit,
    partialEmit: async (ctx) => emit(ctx),
  };
};
