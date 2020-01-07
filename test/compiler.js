const path = require('path')
const webpack = require('webpack')
// const Memoryfs = require('memory-fs')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

export default () => {
  const compiler = webpack({
    context: __dirname,
    entry: './files/entry.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.js'
    },
    mode: 'development',
    devtool: 'none',
    plugins: [
      new MiniCssExtractPlugin({
        filename: `style.css`
      })
    ],
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            path.resolve(__dirname, '../src/loader.js')
          ]
        },
        {
          test: /\.(png|jpg|gif)$/,
          use: [
            {
              loader: 'url-loader',
              options: {
                limit: 8192
              }
            }
          ]
        }
      ]
    }
  })

  // compiler.outputFileSystem = new Memoryfs()

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) reject(err)

      resolve(stats)
    })
  })
}
