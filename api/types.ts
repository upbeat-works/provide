/** Cloudflare Worker environment bindings */
export type Env = {
  Bindings: {
    DB: D1Database;
  };
};

/** A registered ixmp4 instance in the federation */
export interface Ixmp4Instance {
  /** Unique identifier for this instance */
  id: string;
  /** Human-readable name */
  name: string;
  /** Base URL of the ixmp4 REST API */
  url: string;
}
