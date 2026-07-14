/** Universal search-agent bar — brutal frame, lime submit, mandatory AI-assisted hint line. */
export interface SearchBarProps {
  placeholder?: string;
  onSubmit?: (query: string) => void;
  /** Disclosure hint under the field; keep the AI-ASSISTED wording */
  hint?: string;
}
export declare function SearchBar(props: SearchBarProps): JSX.Element;
