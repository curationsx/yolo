/** Editorial section title; *asterisk* segments render as coral Fraunces italics. */
export interface SectionTitleProps {
  /** String with *emphasized* segments, or nodes */
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  /** CSS font-size override; default clamp(2.3rem,4vw,3.75rem) */
  size?: string;
  style?: React.CSSProperties;
}
export declare function SectionTitle(props: SectionTitleProps): JSX.Element;
