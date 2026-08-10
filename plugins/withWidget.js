/**
 * Config Plugin: 注入桌面小组件（Android AppWidget）到原生项目。
 *
 * 在 prebuild 时：
 * 1. 复制 QuickNoteWidget.kt 到 android/app/src/main/java/{pkg}/
 * 2. 复制 widget_layout.xml 到 res/layout/
 * 3. 复制 widget_info.xml 到 res/xml/
 * 4. 在 AndroidManifest.xml 中注册 receiver
 */
const { withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const WIDGET_FILES_DIR = path.join(__dirname, 'widget-files');

function withWidget(config) {
  // ---- 1. 写入 Kotlin / 资源文件 ----
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidProjectRoot = config.modRequest.platformProjectRoot;
      const pkg = config.android.package; // com.foodledger.app
      const pkgPath = pkg.replace(/\./g, '/');

      // Kotlin 文件（替换包名占位符）
      const kotlinDir = path.join(androidProjectRoot, 'app/src/main/java', pkgPath);
      fs.mkdirSync(kotlinDir, { recursive: true });
      const ktTemplate = fs.readFileSync(
        path.join(WIDGET_FILES_DIR, 'QuickNoteWidget.kt'),
        'utf8'
      );
      fs.writeFileSync(
        path.join(kotlinDir, 'QuickNoteWidget.kt'),
        ktTemplate.replace(/__PACKAGE__/g, pkg)
      );

      // res/layout/widget_layout.xml
      const layoutDir = path.join(androidProjectRoot, 'app/src/main/res/layout');
      fs.mkdirSync(layoutDir, { recursive: true });
      fs.copyFileSync(
        path.join(WIDGET_FILES_DIR, 'widget_layout.xml'),
        path.join(layoutDir, 'widget_layout.xml')
      );

      // res/xml/widget_info.xml
      const xmlDir = path.join(androidProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.copyFileSync(
        path.join(WIDGET_FILES_DIR, 'widget_info.xml'),
        path.join(xmlDir, 'widget_info.xml')
      );

      return config;
    },
  ]);

  // ---- 2. 注册 receiver 到 AndroidManifest.xml ----
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0];
    application.receiver = application.receiver || [];

    // 避免重复添加
    const exists = application.receiver.some(
      (r) => r.$?.['android:name'] === '.QuickNoteWidget'
    );
    if (!exists) {
      application.receiver.push({
        $: {
          'android:name': '.QuickNoteWidget',
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/widget_info',
            },
          },
        ],
      });
    }

    return config;
  });

  return config;
}

module.exports = withWidget;
