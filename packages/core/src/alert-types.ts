export type AlertDirection = "above" | "below";

export interface AlertInput {
  direction: AlertDirection;
  thresholdCents: number;
}

export interface Alert {
  id: string;
  variantId: string;
  cardSlug: string;
  cardName: string;
  setName: string;
  condition: string;
  printing: string;
  language: string;
  direction: AlertDirection;
  thresholdCents: number;
  active: boolean;
  /** Current market price of the variant; null when unpriced. */
  priceCents: number | null;
  /** The price already meets the alert's condition. */
  conditionMet: boolean;
  lastTriggeredAt: Date | null;
  lastTriggeredPriceCents: number | null;
}

/** A notification waiting to be emailed, with what the email needs to say. */
export interface PendingNotification {
  id: string;
  userId: string;
  email: string;
  userName: string;
  cardSlug: string;
  cardName: string;
  setName: string;
  condition: string;
  printing: string;
  direction: AlertDirection;
  thresholdCents: number;
  priceCents: number;
  attempts: number;
}
