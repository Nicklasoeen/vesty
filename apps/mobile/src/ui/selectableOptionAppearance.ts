export type SelectableOptionSurfaceToken = 'mintSoft' | 'surface';
export type SelectableOptionBorderToken = 'accent' | 'border';
export type SelectableOptionIndicator = 'filled' | 'empty';
export type SelectableOptionTitleEmphasis = 'strong' | 'default';

export interface SelectableOptionAppearance {
  selected: boolean;
  indicator: SelectableOptionIndicator;
  surfaceToken: SelectableOptionSurfaceToken;
  borderToken: SelectableOptionBorderToken;
  titleEmphasis: SelectableOptionTitleEmphasis;
  accessibilityRole: 'radio';
}

/**
 * Shared selected/unselected language for Create Club choices.
 * Selected must be more than darker text: fill, border, and indicator.
 */
export function presentSelectableOptionAppearance(selected: boolean): SelectableOptionAppearance {
  return {
    selected,
    indicator: selected ? 'filled' : 'empty',
    surfaceToken: selected ? 'mintSoft' : 'surface',
    borderToken: selected ? 'accent' : 'border',
    titleEmphasis: selected ? 'strong' : 'default',
    accessibilityRole: 'radio',
  };
}
