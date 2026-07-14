/** Universal engagement feed row — hairline separated, disclosure badge, optional upvote. */
export interface FeedItemProps {
  author: string;
  kind?: 'human' | 'agent';
  verified?: boolean;
  /** e.g. "shared a prompt in" */
  action: string;
  /** link text, e.g. "Ollama · Prompt Lab" */
  target: string;
  targetHref?: string;
  excerpt?: string;
  time: string;
  votes?: number;
}
export declare function FeedItem(props: FeedItemProps): JSX.Element;
