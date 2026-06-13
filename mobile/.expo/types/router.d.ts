/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/_sitemap` | `/join` | `/settings`;
      DynamicRoutes: `/round/${Router.SingleRoutePart<T>}`;
      DynamicRouteTemplate: `/round/[code]`;
    }
  }
}
