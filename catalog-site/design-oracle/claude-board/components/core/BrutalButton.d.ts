/**
 * Brutalist CTA button — lime bg, 4px near-black border, hard offset shadow.
 * @startingPoint section="Core" subtitle="Brutal CTA button" viewport="700x220"
 */
export interface BrutalButtonProps {
  /** primary = lime, secondary = grey, tertiary = orchid, coral = brand red */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'coral';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function BrutalButton(props: BrutalButtonProps): JSX.Element;
