import type { ServerBuild } from "@remix-run/cloudflare";
import type { GetLoadContextFunction } from "@remix-run/cloudflare-workers";
import {
  createRequestHandler,
  handleAsset,
} from "@remix-run/cloudflare-workers";

import manifestJSON from "__STATIC_CONTENT_MANIFEST";

const assetManifest = JSON.parse(manifestJSON);

interface Environment {
  __STATIC_CONTENT: KVNamespace<string>;
}

export function createEventHandler({
  build,
  getLoadContext,
  mode,
}: {
  build: ServerBuild;
  getLoadContext?: GetLoadContextFunction;
  mode?: string;
}) {
  let handleRequest = createRequestHandler({
    build,
    getLoadContext,
    mode,
  });

  let handleEvent = async (
    request: Request,
    env: Environment,
    ctx: ExecutionContext,
  ) => {
    const event = {
      request,
      waitUntil: ctx.waitUntil.bind(ctx),
      passThroughOnException: ctx.passThroughOnException.bind(ctx),
    } as FetchEvent;

    let response = await handleAsset(event, build, {
      ASSET_NAMESPACE: env.__STATIC_CONTENT,
      ASSET_MANIFEST: assetManifest,
    });

    if (!response) {
      response = await handleRequest(event);
    }

    return response;
  };

  return (request: Request, env: Environment, ctx: ExecutionContext) => {
    try {
      return handleEvent(request, env, ctx);
    } catch (e: any) {
      if (process.env.NODE_ENV === "development") {
        return new Response(e.message || e.toString(), {
          status: 500,
        });
      }

      return new Response("Internal Error", { status: 500 });
    }
  };
}
