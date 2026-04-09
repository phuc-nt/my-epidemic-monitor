// Core base
export { Panel } from '@/components/panel-base';
export type { PanelOptions } from '@/components/panel-base';
export { MapShell } from '@/components/map-shell';

// Disease panels
export { DiseaseOutbreaksPanel } from '@/components/disease-outbreaks-panel';
export { TopDiseasesPanel } from '@/components/top-diseases-panel';

// Map overlays
export { MapPopup } from '@/components/map-popup';
export { MapLayerControls } from '@/components/map-layer-controls';

// Map layers
export {
  updateMapLayers,
  toggleLayer,
  getLayerVisibility,
} from '@/components/map-layers/index';
export type { LayerName, LayerCallbacks } from '@/components/map-layers/index';
