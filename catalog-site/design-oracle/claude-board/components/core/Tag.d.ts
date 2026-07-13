/** Square mono tag/chip for stacks, categories, thread topics. */
export interface TagProps {
  children: React.ReactNode;
  tone?: 'neutral' | 'coral' | 'lime' | 'blue';
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function Tag(props: TagProps): JSX.Element;
