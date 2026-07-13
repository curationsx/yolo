/**
 * Featured company card for the landing list view. Upvote control bottom-right.
 * @startingPoint section="Community" subtitle="Company card with upvote" viewport="700x260"
 */
export interface ContentCardProps {
  name: string;
  /** e.g. "model-access" — mono uppercase, accent colored */
  category: string;
  description: string;
  tags?: string[];
  votes?: number;
  threads?: number;
  /** per-company accent color; defaults to coral */
  accent?: string;
  href?: string;
  onOpen?: () => void;
}
export declare function ContentCard(props: ContentCardProps): JSX.Element;
