# Remix Cloudflare Module Workers

Use [Remix](https://remix.run/) with [Cloudflare module workers](https://developers.cloudflare.com/workers/)

## Motivation

The official `remix-cloudflare-workers` adapter does not support Cloudflare Workers's [new Module Worker format](https://developers.cloudflare.com/workers/learning/migrating-to-module-workers/). Some of Workers new features (like Durable Objects and D1) are not supported using the Service Worker syntax, so that's where this package come in.

## Usage

Since the changes needed to use `remix-cloudflare-module-workers` are minimal, you can use the official `create-remix` command. When prompted where you want to deploy, choose "Cloudflare Workers"

```sh
npx create-remix@latest
```

`cd` into your project and install `remix-cloudflare-module-workers`

```sh
npm i remix-cloudflare-module-workers
```

Replace `server.ts` with this snippet:

```typescript
import { createEventHandler } from "remix-cloudflare-module-workers";
import * as build from "@remix-run/dev/server-build";

export default {
  fetch: createEventHandler({ build, mode: process.env.NODE_ENV }),
};
```

Change the `serverDependenciesToBundle` in `remix.config.js`:

```diff
-   serverDependenciesToBundle: "all",
+   serverDependenciesToBundle: [/^(?!(__STATIC_CONTENT_MANIFEST)$).*$/u],
```

Run `miniflare` with the `--modules` flag in `package.json`:

```diff
    "scripts": {
-     "dev:miniflare": "cross-env NODE_ENV=development miniflare ./build/index.js --watch",
+     "dev:miniflare": "cross-env NODE_ENV=development miniflare ./build/index.js --watch --modules",
```

That's it! Run `npm run dev` to start the dev server.

## Environment variables and bindings

See also the [Workers docs on environment variables](https://developers.cloudflare.com/workers/platform/environment-variables/)

With module Workers, environment variables and bindings are available on the `env` parameter passed to the Worker's `fetch` event handler. You can rewrite the `fetch` event handler to access them before passing the request to Remix's `createEventHandler`.

```typescript
// server.ts

import { createEventHandler } from 'remix-cloudflare-module-workers';
import * as build from '@remix-run/dev/server-build';

export type Environment = {
  __STATIC_CONTENT: KVNamespace<string>;
  NODE_ENV: string;
  // add your env variable / bindings types here
};
  
export default {
  async fetch(request: Request, env: Environment, ctx: ExecutionContext){
    console.log(env);
    return createEventHandler({
      build,
      mode: process.env.NODE_ENV,
    })(request, env, ctx);
  },
};
```

### `env` helper service

To access the Worker's `env` throughout your Remix app, you can create a small helper service to easily set and retrieve the `env`.

```typescript
// services/environment.server

export type Environment = {
  __STATIC_CONTENT: KVNamespace<string>; // this is required
  NODE_ENV: string;
  YOUR_ENV_VARIABLE: string;
};

export function setEnvironment(e: Environment) {
  env = e;
}

export let env: Environment;
```

And update `server.ts` as follows

```diff
+ import type { Environment } from "~/services/environment.server";
+ import { setEnvironment } from "~/services/environment.server";

- export type Environment = {
-   __STATIC_CONTENT: KVNamespace<string>;
-   NODE_ENV: string;
- };
  
  export default {
    async fetch(request: Request, env: Environment, ctx: ExecutionContext){
+     setEnvironment(env);
      return createEventHandler({
        build,
        mode: process.env.NODE_ENV,
      })(request, env, ctx);
    },
  };
```

Now, you can access the Worker's `env` anywhere (server-side) in your Remix app.

```typescript
// anywhere.server.ts
import { env } from "~/services/environment.server";

console.log(env.YOUR_ENV_VARIABLE)
```

### `getLoadContext`

Alternatively, you can also bind `env` to your loaders and actions context by using Remix's built-in `getLoadContext`. To get type suggestions, you'll need to override Remix's `AppLoadContext` type.

In `server.ts`

```diff
  export type Environment = {
    __STATIC_CONTENT: KVNamespace<string>;
    NODE_ENV: string;
    // add your env variable / bindings types here
  };

+ declare module "@remix-run/server-runtime" {
+   interface AppLoadContext extends Environment {}
+ }
  
  export default {
    async fetch(request: Request, env: Environment, ctx: ExecutionContext){
+     function getLoadContext() {
+       return env;
+     }
      return createEventHandler({
        build,
+       getLoadContext,
        mode: process.env.NODE_ENV,
      })(request, env, ctx);
    },
  };
```

In your loaders and actions, you can use the `context` param now to access your environment variables and bindings.

```typescript
// app/routes/_index.tsx

export async function loader({ request, context }: LoaderArgs) {
  console.log(context.YOUR_ENV_VARIABLE)

  return json({
    your_env: context.YOUR_ENV_VARIABLE
  });
}
```

### Secrets in development
When locally developing your Remix app, create a `.env` file in the root of your project to define your environment variables. Remix uses Miniflare for developing, read the [Miniflare docs on environment variables](https://miniflare.dev/core/variables-secrets) for more.