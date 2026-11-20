/**
 * Sending WhatsApp messages.
 *
 * Two implementations, one interface, and a rule about what the interface may promise.
 *
 * **`manual` is the default and the only one that works today.** It produces a `wa.me` link that the
 * operator taps; the message is composed here, in the guest's language, with their hall, their name
 * and their link already in it — but the sending is WhatsApp's, from the operator's own number
 * (+97366661238), exactly as it is now. No API keys, no template approval, no per-message cost, and
 * it cannot silently fail.
 *
 * **`cloud` is a seam, not a feature.** The WhatsApp Business Cloud API needs a verified business, an
 * approved message template for every purpose, and a token; none of that exists here. The provider is
 * written so that adding it is a change to this file and an environment variable, not a change to
 * every call site — and it says loudly that it is not configured rather than pretending to send.
 *
 * What no provider may do is claim success it cannot observe. `manual` reports `sent: false` with a
 * link, because opening WhatsApp is not sending.
 */
import { DEFAULT_WHATSAPP, renderTemplate, type Locale, type WhatsappPurpose } from "@/features/invitations/messages";

export interface OutgoingMessage {
  /** E.164, as stored. */
  to: string;
  body: string;
}

export interface SendResult {
  /** True only when a provider confirms the platform accepted the message. */
  sent: boolean;
  /** A link the operator can open, when the provider is the operator. */
  link?: string;
  provider: string;
  error?: string;
}

export interface WhatsappProvider {
  readonly id: string;
  /** Whether this provider actually transmits. */
  readonly transmits: boolean;
  send(message: OutgoingMessage): Promise<SendResult>;
}

/** `wa.me` needs digits only: no plus, no spaces, no dashes. */
export function waLink(phone: string, body: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

/**
 * The operator's own WhatsApp: compose, and let them press send.
 *
 * This is what ships. It is honest about what it is — `sent: false` — so nothing downstream can
 * record a message as delivered that a person has not actually sent.
 */
export const manualProvider: WhatsappProvider = {
  id: "manual",
  transmits: false,
  async send(message) {
    return { sent: false, provider: "manual", link: waLink(message.to, message.body) };
  },
};

/**
 * The WhatsApp Business Cloud API.
 *
 * Deliberately inert: it reports the configuration it is missing rather than throwing at a call site,
 * and it never reports `sent` for a request it did not make.
 */
export function cloudProvider(config: { token?: string; phoneNumberId?: string }): WhatsappProvider {
  return {
    id: "cloud",
    transmits: Boolean(config.token && config.phoneNumberId),
    async send() {
      if (!config.token || !config.phoneNumberId) {
        return {
          sent: false,
          provider: "cloud",
          error: "WhatsApp Cloud API is not configured: set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.",
        };
      }
      // Left unimplemented on purpose. Sending with the Cloud API requires an approved template per
      // purpose; composing free text would be rejected by WhatsApp, and pretending otherwise would
      // make this function look finished.
      return {
        sent: false,
        provider: "cloud",
        error: "Cloud sending is not implemented yet: it needs an approved template per purpose.",
      };
    },
  };
}

export function resolveProvider(env: Record<string, string | undefined> = process.env): WhatsappProvider {
  if (env.WHATSAPP_PROVIDER === "cloud") {
    return cloudProvider({ token: env.WHATSAPP_TOKEN, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID });
  }
  return manualProvider;
}

/**
 * The body of one message, from the template for that purpose and that language.
 *
 * Kept here rather than in the provider because it is the same text either way: a Cloud template and
 * a `wa.me` link must say the same thing, or the two paths drift and one of them is wrong.
 */
export function composeMessage(input: {
  purpose: WhatsappPurpose;
  locale: Locale;
  variables: Record<string, string | undefined>;
  overrides?: Record<string, Record<string, string>> | null;
}): string {
  const template =
    input.overrides?.[input.purpose]?.[input.locale]?.trim() || DEFAULT_WHATSAPP[input.purpose][input.locale];
  return renderTemplate(template, input.variables);
}