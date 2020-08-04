const debug = require('debug')('css-sprites-loader')
const fs = require('fs-extra')
const path = require('path')
const css = require('css')
const Spritesmith = require('spritesmith')
const loaderUtils = require('loader-utils')

const URL_REG = /url\(['"]?(.+?\.(png|jpg|jpeg|gif))(.*)['"]?\)/i

/**
 *  是否是网络图片
 */

function isNetworkImg (value) {
  if (!value || typeof value !== 'string') {
    return false
  }

  return /^(\/\/|http|https).+?/.test(value)
}

/**
 * 是否是小图片
 */

function isSmallImg ({ url, limit }) {
  let isShouldSprite = false

  try {
    const status = fs.lstatSync(url)
    isShouldSprite = status.size <= limit
  } catch (error) {
    console.log(error)
  }

  return isShouldSprite
}

/**
 * 从 ast 中提取 image url
 */

function getImageRulsFromAst (ast, context, options) {
  const rules = []
  const {
    filter = 'query',
    limit = 8192,
    params = '__sprite'
  } = options

  ast.stylesheet.rules.forEach((rule) => {
    if (!rule.declarations) {
      return
    }

    rule.declarations.forEach((declaration) => {
      const { property, value } = declaration

      if (property !== 'background' && property !== 'background-image') {
        return
      }

      const matched = value.match(URL_REG)

      if (!matched || !matched[1]) {
        return
      }

      const url = path.join(context, matched[1])

      //  网络图片不处理
      if (isNetworkImg(matched && matched[1])) {
        return
      }

      if (filter === 'query' && value.indexOf(params) <= -1) {
        return
      }

      if (!isSmallImg({ url, limit })) {
        return
      }

      debug(`css sprite loader: ${url}`)

      rules.push({
        url,
        declaration,
        rule
      })
    })
  })

  return rules
}

/**
 * background-position 转换
 */

function getPosition (num, item, total) {
  if (!num) {
    return '0%'
  }

  return `${(-num / (item - total) * 100).toFixed(4)}%`
}

/**
 * background-size 转换
 */

function getSize (item, total) {
  return `${(total / item * 100).toFixed(4)}%`
}

/**
 * 获取临时目录
 */

function getTmpDir () {
  const webpackPath = require.resolve('webpack')
  const nodeModulesDir = webpackPath.replace(/node_modules\/.*/, 'node_modules')
  const tmpDir = path.join(nodeModulesDir, '.sprites')

  fs.ensureDirSync(tmpDir)

  debug(`webpackPath: ${webpackPath}`)
  debug(`nodeModulesDir: ${nodeModulesDir}`)
  debug(`tmpDir: ${tmpDir}`)

  return tmpDir
}

/**
 * 生成文件
 */

function emitFile (image, name = 'sprite.[contenthash:6].png') {
  const ctx = this
  const spriteFileName = loaderUtils.interpolateName(ctx, name, {
    content: image
  })

  const outputPath = getTmpDir()
  const absolutePath = path.join(outputPath, spriteFileName)

  fs.writeFileSync(absolutePath, image)

  debug(`sprite file absolute path: ${absolutePath}`)

  return spriteFileName
}

function loader (content, map, meta) {
  debug('run...')

  const ctx = this
  const callback = ctx.async()
  const context = ctx.context

  const options = loaderUtils.getOptions(ctx)

  const ast = css.parse(content)

  if (!ast.stylesheet.rules) {
    debug('no rules, exit')

    callback(null, content, map, meta)
    return
  }

  const imageRules = getImageRulsFromAst(ast, context, options)
  const imageUrls = imageRules.map(item => item.url)

  debug('webpack ast: %j', ast)
  debug('imageRules: %j', imageRules)

  if (!imageUrls.length) {
    debug('no image, exit')

    callback(null, content, map, meta)
    return
  }

  /**
   * Spritesmith 回调
   */

  function handleSpritesmithResult (error, result) {
    if (error) {
      callback(error)
      return
    }

    /**
     * 生成文件
     */
    const spriteFileName = emitFile.call(ctx, result.image)

    /**
     * 修改 css
     */
    const { width, height } = result.properties

    imageRules.forEach(({ url, declaration, rule }) => {
      const {
        x, y, width: imageWidth, height: imageHeight
      } = result.coordinates[url]

      // url 替换为 ~.sprites（node_modules 下的临时目录），css-loader 等会处理好
      // eslint-disable-next-line
      declaration.value = declaration.value.replace(/url\(.+?\)/i, `url(~.sprites/${spriteFileName})`);

      const positionX = getPosition(x, imageWidth, width)
      const positionY = getPosition(y, imageHeight, height)
      const sizeX = getSize(imageWidth, width)
      const sizeY = getSize(imageHeight, height)

      const newRules = [
        {
          type: 'declaration',
          property: 'background-position',
          value: `${positionX} ${positionY}`
        },
        {
          type: 'declaration',
          property: 'background-size',
          value: `${sizeX} ${sizeY}`
        }
      ]

      debug(`new rules ${url}: %O`, newRules)

      rule.declarations.push(...newRules)
    })

    const newContent = css.stringify(ast)
    callback(null, newContent, map, null)
  }

  Spritesmith.run({
    src: imageUrls,
    algorithm: 'binary-tree',
    padding: 5
  }, handleSpritesmithResult)
}

module.exports = loader
