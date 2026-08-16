export type SubscriberStatus = 'ACTIVE' | 'UNSUBSCRIBED';

export interface Subscriber {
  id: string;
  email: string;
  status: SubscriberStatus;
  createdAt: string;
  updatedAt: string;
}
