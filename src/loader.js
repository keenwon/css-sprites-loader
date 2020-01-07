'use strict'

const path = require('path')
const css = require('css')
const Spritesmith = require('spritesmith')
const loaderUtils = require('loader-utils')

const URL_REG = /url\(['"]?(.+\.(png|jpg|jpeg|gif))(.*)['"]?\)/i

function getImageRulsFromAst (ast) {
  const rules = []

  ast.stylesheet.rules.forEach(rule => {
    rule.declarations.forEach(({ property, value }) => {
      if (property !== 'background' && property !== 'background-image') {
        return
      }

      const matched = value.match(URL_REG)

      if (!matched) {
        return
      }

      rules.push({
        url: matched[1],
        rule
      })
    })
  })

  return rules
}

function loader (content, map, meta) {
  const ctx = this
  const callback = ctx.async()
  const context = ctx.context
  const options = loaderUtils.getOptions(ctx) || {}
  const outputPath = options.outputPath || ''

  const ast = css.parse(content)
  const imageRules = getImageRulsFromAst(ast)
  const imageUrls = imageRules.map(item => path.join(context, item.url))

  console.log(imageUrls)
  console.log(JSON.stringify(ast))

  Spritesmith.run({
    src: imageUrls
  }, function handleSpritesmithResult (error, result) {
    if (error) {
      return callback(error)
    }

    ctx.emitFile(outputPath + 'sprite.png', result.image)

    callback(null, content, map, meta)
  })
}

module.exports = loader
