const compiler = require('./compiler.js')

test('test', async () => {
  const stats = await compiler()
  expect(stats.toJson()).toBeTruthy()
})
