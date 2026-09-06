import Svg, { Polygon } from 'react-native-svg';

const VIEW_BOX_WIDTH = 155;
const VIEW_BOX_HEIGHT = 164;

interface VestyMarkProps {
  color: string;
  /** Rendered height in dp. Width scales from the icon viewBox. */
  height?: number;
}

/**
 * Standalone Vesty mark from apps/mobile/assets/rebrand/vesty-icon-rb.svg.
 * Themeable fill via react-native-svg (no Metro SVG transformer required).
 */
export function VestyMark({ color, height = 24 }: VestyMarkProps) {
  const width = height * (VIEW_BOX_WIDTH / VIEW_BOX_HEIGHT);

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VIEW_BOX_WIDTH} ${VIEW_BOX_HEIGHT}`} role="img" aria-label="Vesty">
      <Polygon points="155,0 89,61 89,119 155,51" fill={color} />
      <Polygon points="0,37 0,94 69,163 130,164" fill={color} />
    </Svg>
  );
}
