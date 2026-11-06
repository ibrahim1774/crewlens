// Xcode 26.3's swift-frontend crashes (AArch64 ISel) compiling SuperwallKit in Release with
// whole-module optimisation. Build only that pod unoptimised; it is the paywall SDK, so the
// runtime cost is negligible. Remove once Xcode or SuperwallKit fixes it.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARK = '# with-superwall-onone';
const SNIPPET = `
    ${MARK}
    installer.pods_project.targets.each do |t|
      next unless t.name.start_with?('SuperwallKit')
      t.build_configurations.each do |c|
        c.build_settings['SWIFT_OPTIMIZATION_LEVEL'] = '-Onone'
        c.build_settings['SWIFT_COMPILATION_MODE'] = 'singlefile'
      end
    end`;

module.exports = function withSuperwallOnone(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let src = fs.readFileSync(file, 'utf8');
      if (!src.includes(MARK)) {
        src = src.replace(/post_install do \|installer\|\n/, (m) => m + SNIPPET + '\n');
        fs.writeFileSync(file, src);
      }
      return cfg;
    },
  ]);
};
