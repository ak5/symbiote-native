module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    require('@babel/plugin-transform-class-static-block'),
    require('@symbiote-native/angular/babel-register-composed'),
    require('@symbiote-native/angular/babel-linker'),
    'babel-plugin-transform-flow-enums',
  ],
};
