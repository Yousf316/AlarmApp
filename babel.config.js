module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module:react-native-vector-icons/plugin',
      {
        platforms: {
          ios: true,
          android: true,
        },
      },
    ],
  ],
};