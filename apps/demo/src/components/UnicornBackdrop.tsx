import UnicornScene from 'unicornstudio-react';

const SCENE_JSON_PATH = '/unicorn/ai-loading-remix.json';
const SDK_URL = 'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.1.5/dist/unicornStudio.umd.js';

export function UnicornBackdrop() {
  return (
    <div aria-hidden="true" className="ces-unicorn-backdrop pointer-events-none absolute inset-0 z-[1] overflow-hidden">
      <div className="h-full w-full opacity-68">
        <UnicornScene
          jsonFilePath={SCENE_JSON_PATH}
          sdkUrl={SDK_URL}
          width="100%"
          height="100%"
          className="ces-unicorn-scene"
          scale={1}
          dpi={1.5}
          lazyLoad={false}
          production
        />
      </div>
    </div>
  );
}
