'use strict'

const fs = require('fs-extra')
const path = require('path')
const css = require('css')
const Spritesmith = require('spritesmith')
const loaderUtils = require('loader-utils')

const URL_REG = /url\(['"]?(.+\.(png|jpg|jpeg|gif))(.*)['"]?\)/i

/**
 * 从 ast 中提取 image url
 */

function getImageRulsFromAst (ast, context) {
  const rules = []

  ast.stylesheet.rules.forEach(rule => {
    rule.declarations.forEach(declaration => {
      const { property, value } = declaration

      if (property !== 'background' && property !== 'background-image') {
        return
      }

      const matched = value.match(URL_REG)

      if (!matched || !matched[1]) {
        return
      }

      const url = path.join(context, matched[1])

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
 * 百分比转换
 */

function toPercent (number, total) {
  return `${(number / total * 100).toFixed(4)}%`
}

/**
 * 获取临时目录
 */

function getTmpDir () {
  const webpackPath = require.resolve('webpack')
  const nodeModulesDir = webpackPath.replace(/node_modules\/.*/, 'node_modules')
  const tmpDir = path.join(nodeModulesDir, '.sprites')

  fs.ensureDirSync(tmpDir)

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

  return spriteFileName
}

function loader (content, map, meta) {
  const ctx = this
  const callback = ctx.async()
  const context = ctx.context

  const ast = css.parse(content)
  const imageRules = getImageRulsFromAst(ast, context)
  const imageUrls = imageRules.map(item => item.url)

  if (!imageUrls.length) {
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
      const { x, y } = result.coordinates[url]

      const percentX = toPercent(x, width)
      const percentY = toPercent(y, height)

      declaration.value = declaration.value.replace(/url\(.+?\)/i, `url(~.sprites/${spriteFileName})`)

      const newRules = [
        {
          type: 'declaration',
          property: 'background-position',
          value: `${percentX} ${percentY}`
        }
      ]

      rule.declarations.push(...newRules)
    })

    const newContent = css.stringify(ast)

    console.log(newContent)

    callback(null, newContent, map, meta)
  }

  Spritesmith.run({
    src: imageUrls,
    algorithm: 'binary-tree',
    padding: 5
  }, handleSpritesmithResult)
}

module.exports = loader
