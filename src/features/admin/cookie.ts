/**
 * The admin session cookie's name, in a module with no imports.
 *
 * It lives on its own because two very different runtimes need it: the session code, which runs on
 * the Node server and opens a database connection, and the middleware, which runs at the edge and
 * can do neither. A shared string constant is cheaper and far safer than importing a module that
 * pulls a database driver into the edge bundle.
 */
export const ADMIN_SESSION_COOKIE = "velora_admin";
