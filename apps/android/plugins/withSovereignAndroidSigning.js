const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withSovereignAndroidSigning(config) {
  return withAppBuildGradle(config, (result) => {
    if (result.modResults.language !== 'groovy') return result;

    let contents = result.modResults.contents;
    if (!contents.includes('SOVEREIGN_UPLOAD_STORE_FILE')) {
      contents = contents.replace(
        'signingConfigs {',
        `signingConfigs {
        release {
            if (System.getenv("SOVEREIGN_UPLOAD_STORE_FILE")) {
                storeFile file(System.getenv("SOVEREIGN_UPLOAD_STORE_FILE"))
                storePassword System.getenv("SOVEREIGN_UPLOAD_STORE_PASSWORD")
                keyAlias System.getenv("SOVEREIGN_UPLOAD_KEY_ALIAS")
                keyPassword System.getenv("SOVEREIGN_UPLOAD_KEY_PASSWORD")
            }
        }`,
      );

      const marker = 'signingConfig signingConfigs.debug';
      const lastMarker = contents.lastIndexOf(marker);
      if (lastMarker < 0) throw new Error('ANDROID_RELEASE_SIGNING_MARKER_NOT_FOUND');
      contents = `${contents.slice(0, lastMarker)}signingConfig System.getenv("SOVEREIGN_UPLOAD_STORE_FILE") ? signingConfigs.release : signingConfigs.debug${contents.slice(lastMarker + marker.length)}`;
    }

    result.modResults.contents = contents;
    return result;
  });
};
