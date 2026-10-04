const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('onnx');

// The package's web entry uses a dynamic import Metro cannot parse.
// The plain wasm build is a normal script and loads its runtime from /ort/.
const wasmRuntime = path.join(__dirname, 'src/lib/vendor/ort.wasm.min.js');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'onnxruntime-web/wasm') {
    return { type: 'sourceFile', filePath: wasmRuntime };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
