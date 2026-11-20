"use client";

import { useEffect, useRef, useState } from "react";

import { VenueIcon, type IconVariant } from "./VenueIcons";

/**
 * The venues: two icons, two sheets, and no way to be sent to the wrong hall.
 *
 * **Both halls are always shown.** A guest invited to the men's hall still needs to tell his mother
 * where the women's hall is; hiding the other one produces a phone call, and the phone call is the
 * operator's evening. The guest's own hall gets a gold ring and a small label; nothing is removed.
 *
 * **The dialog is a native `<dialog>` with `showModal()`.** That is not a shortcut, it is the correct
 * tool: the browser gives the focus trap, `aria-modal`, Escape-to-close, the top layer (so the page
 * behind cannot be scrolled or clicked) and — the part people forget — the return of focus to the
 * element that opened it. A hand-rolled modal reimplements all five, usually badly.
 *
 * **Nothing here can shift the layout.** `showModal()` puts the dialog in the top layer, which is
 * outside the flow: opening it moves nothing. The scroll lock is the browser's, and `scrollbar-gutter:
 * stable` is already on `html`, so the absent scrollbar changes no width. Everything animated is
 * transform and opacity.
 *
 * The content is rendered from props, so a language change re-renders the sheet in place — the dialog
 * stays open, which is the behaviour the brief asks for.
 */
export interface VenueCardData {
  id: string;
  kind: "women" | "men" | "shared";
  /** The hall's name, or a plain label when the operator left the name empty. */
  name: string;
  /** The words under the icon: "Women's Hall Location" and so on. */
  iconLabel: string;
  emphasis: boolean;
  address: string;
  time: string;
  mapUrl: string | null;
  mapLabel: string;
  entrance: string;
  parking: string;
  dressCode: string;
  notes: string;
  phone: string | null;
}

export interface VenueLabels {
  sectionTitle: string;
  yourHall: string;
  close: string;
  openInMaps: string;
  copyAddress: string;
  copied: string;
  call: string;
  address: string;
  time: string;
  entrance: string;
  parking: string;
  dressCode: string;
  notes: string;
  venueOne: string;
}

export function VenuesSection({
  venues,
  variant,
  labels,
  accent,
}: {
  venues: VenueCardData[];
  variant: IconVariant;
  labels: VenueLabels;
  accent: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);

  const open = venues.find((venue) => venue.id === openId) ?? null;

  // The dialog is opened and closed imperatively: `showModal()` is what creates the focus trap and
  // the top layer, and there is no declarative equivalent.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => {
    setCopied(false);
    setOpenId(null);
  };

  // Swipe down to dismiss, on the handle only — a swipe anywhere would fight the content's own
  // scrolling, and a guest reading a parking note should not close it by scrolling.
  const onTouchStart = (event: React.TouchEvent) => {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  };
  const onTouchMove = (event: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = (event.touches[0]?.clientY ?? 0) - touchStartY.current;
    if (delta > 90) {
      touchStartY.current = null;
      close();
    }
  };

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the address is on screen and selectable either way.
    }
  };

  return (
    <section className="venues" aria-labelledby="venues-title">
      <h2 className="venues__title" id="venues-title">
        {labels.sectionTitle}
      </h2>

      <div className="venues__row" data-count={venues.length}>
        {venues.map((venue) => (
          <button
            key={venue.id}
            type="button"
            className="venue-card"
            data-emphasis={venue.emphasis ? "true" : "false"}
            style={{ ["--venue-accent" as string]: accent }}
            onClick={() => setOpenId(venue.id)}
            aria-haspopup="dialog"
          >
            <span className="venue-card__ring" aria-hidden="true" />
            <VenueIcon kind={venue.kind} variant={variant} className="venue-card__icon" />
            <span className="venue-card__label">{venue.iconLabel}</span>
            {venue.emphasis ? <span className="venue-card__you">{labels.yourHall}</span> : null}
          </button>
        ))}
      </div>

      {venues.length === 1 ? <p className="venues__single">{labels.venueOne}</p> : null}

      <dialog
        className="venue-sheet"
        ref={dialogRef}
        onClose={close}
        onClick={(event) => {
          // A click that lands on the dialog itself is a click on the backdrop: the sheet inside
          // stops propagation by being a child with its own box.
          if (event.target === dialogRef.current) close();
        }}
        aria-labelledby="venue-sheet-title"
      >
        {open ? (
          <div className="venue-sheet__panel" ref={sheetRef}>
            <div
              className="venue-sheet__grip"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              aria-hidden="true"
            >
              <span />
            </div>

            <div className="venue-sheet__head">
              <h3 className="venue-sheet__title" id="venue-sheet-title">
                {open.name}
              </h3>
              <button type="button" className="venue-sheet__close" onClick={close} aria-label={labels.close}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
                </svg>
              </button>
            </div>

            <dl className="venue-sheet__details">
              {open.address ? (
                <div>
                  <dt>{labels.address}</dt>
                  <dd>{open.address}</dd>
                </div>
              ) : null}
              {open.time ? (
                <div>
                  <dt>{labels.time}</dt>
                  <dd className="ltr-token" dir="ltr">
                    {open.time}
                  </dd>
                </div>
              ) : null}
              {open.entrance ? (
                <div>
                  <dt>{labels.entrance}</dt>
                  <dd>{open.entrance}</dd>
                </div>
              ) : null}
              {open.parking ? (
                <div>
                  <dt>{labels.parking}</dt>
                  <dd>{open.parking}</dd>
                </div>
              ) : null}
              {open.dressCode ? (
                <div>
                  <dt>{labels.dressCode}</dt>
                  <dd>{open.dressCode}</dd>
                </div>
              ) : null}
              {open.notes ? (
                <div>
                  <dt>{labels.notes}</dt>
                  <dd>{open.notes}</dd>
                </div>
              ) : null}
            </dl>

            <div className="venue-sheet__actions">
              {open.mapUrl ? (
                <a
                  className="venue-sheet__action venue-sheet__action--primary"
                  href={open.mapUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {open.mapLabel}
                </a>
              ) : null}
              {open.address ? (
                <button type="button" className="venue-sheet__action" onClick={() => copyAddress(open.address)}>
                  {copied ? labels.copied : labels.copyAddress}
                </button>
              ) : null}
              {open.phone ? (
                <a className="venue-sheet__action" href={`tel:${open.phone.replace(/[^\d+]/g, "")}`}>
                  {labels.call}
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </section>
  );
}
