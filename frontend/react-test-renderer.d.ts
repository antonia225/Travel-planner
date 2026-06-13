declare module "react-test-renderer" {
  import type { ReactElement } from "react";

  export function create(element: ReactElement): {
    toJSON(): unknown;
  };
  export function act(callback: () => void): void;
}
