import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scaffoldApp } from './generate.js';
import type { IFramework, IVueFlavor } from './types.js';
import { sanitizeNativeAppName } from './utils/native-identity.js';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

const frameworks: ReadonlyArray<[IFramework, IVueFlavor | undefined]> = [
  ['react', undefined],
  ['vue', 'tsx'],
  ['vue', 'sfc'],
  ['svelte', undefined],
  ['solid', undefined],
  ['angular', undefined],
];

describe('generated native Catalyst target', () => {
  it.each(frameworks)(
    '%s (%s) ships the configured and renamed host',
    (framework, vueFlavor) => {
      const root = fs.mkdtempSync(
        path.join(os.tmpdir(), 'symbiote-catalyst-starter-'),
      );
      directories.push(root);
      scaffoldApp({
        appName: root,
        framework,
        vueFlavor,
        bundleId: 'dev.symbiote.desktop',
        hasTypescript: true,
        hasExpoModules: false,
        hasNavigation: false,
        hasTesting: false,
        hasSplashScreen: false,
        hasSlider: false,
        hasReanimated: false,
        styling: 'css',
        packageManager: 'npm',
      });
      const app = sanitizeNativeAppName(root);
      const project = fs.readFileSync(
        path.join(root, 'ios', `${app}.xcodeproj`, 'project.pbxproj'),
        'utf8',
      );
      expect(project.match(/SUPPORTS_MACCATALYST = YES;/g)).toHaveLength(2);
      expect(
        project.match(/"IPHONEOS_DEPLOYMENT_TARGET\[sdk=macosx\*\]" = 15.2;/g),
      ).toHaveLength(2);
      expect(
        project.indexOf('/* Normalize Catalyst frameworks */'),
      ).toBeLessThan(project.indexOf('/* [CP] Embed Pods Frameworks */'));
      expect(project).toContain(
        '$PROJECT_DIR/../scripts/normalize-catalyst-frameworks.mjs',
      );
      const podfile = fs.readFileSync(path.join(root, 'ios/Podfile'), 'utf8');
      expect(podfile).toContain(':mac_catalyst_enabled => true');
      expect(podfile).toContain(
        "config.build_settings['IPHONEOS_DEPLOYMENT_TARGET[sdk=macosx*]'] = '15.2'",
      );
      const manifest = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
      expect(JSON.parse(manifest)).toMatchObject({
        scripts: {
          'macos:build': expect.stringContaining(
            `-workspace ${app}.xcworkspace -scheme ${app}`,
          ),
        },
      });
      expect(manifest).toContain('platform=macOS,variant=Mac Catalyst');
      expect(manifest).not.toContain('Canary');
      const delegate = fs.readFileSync(
        path.join(root, 'ios', app, 'AppDelegate.swift'),
        'utf8',
      );
      expect(delegate).toContain(
        'class SceneDelegate: UIResponder, UIWindowSceneDelegate',
      );
      expect(delegate).toContain('UIWindow(windowScene: windowScene)');
      expect(delegate).toContain(`withModuleName: "${app}"`);
      const info = fs.readFileSync(
        path.join(root, 'ios', app, 'Info.plist'),
        'utf8',
      );
      expect(info).toContain('<key>UIApplicationSceneManifest</key>');
      expect(info).toContain('$(PRODUCT_MODULE_NAME).SceneDelegate');
      expect(
        fs.readFileSync(
          path.join(root, 'scripts/normalize-catalyst-frameworks.mjs'),
          'utf8',
        ),
      ).toContain('export function normalizeCatalystFrameworks');
    },
  );
});
