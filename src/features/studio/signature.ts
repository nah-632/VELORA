import { DesignConfigSchema } from "@/features/catalogue/design-config";

/**
 * The design configuration as it arrives from a browser.
 *
 * `DesignConfigSchema` is the contract; this is the door. Named separately because the two are
 * used for different purposes: the schema describes the document, and this is what a server
 * action hands a value to on the way in.
 */
export const SignatureSchema = DesignConfigSchema;
