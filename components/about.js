const { sha256 } = require('crypto-hash')
const { generateAvatar } = require('../utils')

module.exports = function about (self) {
  return {
    set: async function (data, { logId } = {}) {
      const log = await self.log.get(logId)
      const entry = await log.about.set(data)
      self.peers._announceLogs()
      return self.about.get(entry.payload.value.content.address)
    },
    get: async (logId, { localOnly = false } = {}) => {
      self.logger(`Get about for: ${logId}`)
      let entry, log
      try {
        log = await self.log.get(logId, { replicate: false, localOnly })
        entry = log.about.get()
      } catch (error) {
        self.logger.err(error)
      }
      const entryValue = entry ? entry.payload.value : { content: {} }

      if (!entryValue.id) {
        entryValue.id = await sha256(log.address.toString())
      }

      if (!entryValue.content.avatar) {
        entryValue.content.avatar = generateAvatar(logId)
      }

      if (!entryValue.content.address) {
        entryValue.content.address = log.address.toString()
      }

      return entryValue
    }
  }
}
