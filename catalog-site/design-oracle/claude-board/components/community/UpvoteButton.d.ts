/** Square brutal upvote control — text triangle, count below. Sits bottom-right of ContentCard. */
export interface UpvoteButtonProps {
  count?: number;
  voted?: boolean;
  onVote?: (voted: boolean) => void;
  size?: 'sm' | 'md';
}
export declare function UpvoteButton(props: UpvoteButtonProps): JSX.Element;
