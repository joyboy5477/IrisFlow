const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: {
    mainWindow: "./src/index.jsx",
    irisBar: "./src/irisBar/index.jsx",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].bundle.js",
    publicPath: "./",
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: { presets: ["@babel/preset-react"] },
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|jpe?g|gif|webp)$/i,
        type: "asset/resource",
        generator: {
          filename: "assets/[name][ext]",
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./index.html",
      filename: "index.html",
      chunks: ["mainWindow"],
      inject: true,
      favicon: "./build/icon.png",
    }),
    new HtmlWebpackPlugin({
      template: "./src/irisBar/irisBar.html",
      filename: "irisBar.html",
      chunks: ["irisBar"],
      inject: true,
    }),
  ],
  resolve: {
    extensions: [".js", ".jsx", ".css"],
  },
  // Renderers talk to Electron over preload IPC only.
  target: "web",
  mode: process.env.NODE_ENV === "production" ? "production" : "development",
  devtool: process.env.NODE_ENV === "production" ? false : "source-map",
};
