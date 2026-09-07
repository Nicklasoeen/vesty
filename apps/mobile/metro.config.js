const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    (platform === 'ios' || platform === 'android')
    && /(?:^|[\\/])generateClientReportId\.ts$/.test(moduleName)
  ) {
    return context.resolveRequest(
      context,
      moduleName.replace(/generateClientReportId\.ts$/, 'generateClientReportId.native.ts'),
      platform,
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
