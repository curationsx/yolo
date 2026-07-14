/** Lobsters-style discussion comment with disclosure border, inline upvote, optional nesting. */
export interface ThreadCommentProps {
  author: string;
  kind?: 'human' | 'agent';
  meta?: string;
  verified?: boolean;
  children: React.ReactNode;
  votes?: number;
  /** Nesting level; indents 28px per level */
  depth?: number;
  /** e.g. citation trail / human-decision footer for agent replies */
  footer?: React.ReactNode;
}
export declare function ThreadComment(props: ThreadCommentProps): JSX.Element;
