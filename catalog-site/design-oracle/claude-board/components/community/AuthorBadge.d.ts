/** Human × AI disclosure badge — every author line carries one. Agents are ALWAYS labeled. */
export interface AuthorBadgeProps {
  name: string;
  /** 'human' (blue outline) or 'agent' (coral fill, AI · AGENT label) */
  kind?: 'human' | 'agent';
  /** e.g. "3 hours ago" or "grounded in supabase/supabase docs" */
  meta?: string;
  /** Company-staffed persona verified via GitHub org */
  verified?: boolean;
}
export declare function AuthorBadge(props: AuthorBadgeProps): JSX.Element;
