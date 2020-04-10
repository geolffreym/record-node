const { TrackEntry } = require('../RecordEntry')
const { loadEntryContent } = require('../utils')

module.exports = function (self) {
  return {
    all: async (opts = {}) => {
      let { start, end, random, query } = opts
      const tags = opts.tags && !Array.isArray(opts.tags) ? [opts.tags] : (opts.tags || [])

      if (tags.length && !tags.some(t => self._index.hasTag(t))) {
        return []
      }

      if (random) {
        start = Math.floor(Math.random() * self._index._index.track.size)
        end = start + 1
      }

      let entryHashes = []

      if (query) {
        let results = []
        if (tags.length) {
          results = await self._index._searchIndex.search(query, {
            where: (doc) => {
              return tags.every((tag) => {
                return doc.tags.indexOf(tag) !== -1
              })
            }
          })
        } else {
          results = await self._index._searchIndex.search(query, {
            field: ['title', 'artist', 'resolver']
          })
        }

        entryHashes = results.map(e => self._index._index.track.get(e.key).hash)
      } else {
        const indexEntries = Array
          .from(self._index._index.track.values())
          .reverse()
          .slice(start, end)

        if (tags.length) {
          let i = 0
          while (entryHashes.length < (end || Infinity) && indexEntries[i]) {
            if (tags.every(t => indexEntries[i].tags.includes(t))) {
              entryHashes.push(indexEntries[i].hash)
            }
            i++
          }
        } else {
          entryHashes = indexEntries.map(e => e.hash)
        }
      }

      const promises = entryHashes.map(e => self.tracks.getFromHash(e))
      return Promise.all(promises)
    },

    has: (id) => {
      return !!self._index.getEntryHash(id, 'track')
    },

    findOrCreate: async function (content, shouldPin) {
      const entry = await new TrackEntry().create(self._ipfs, content, shouldPin)
      const track = await self.get(entry.id, 'track')

      // doesn't exist, add
      if (!track) {
        return this._add(entry, shouldPin)
      }

      // exists, but changed
      const contentCID = track.payload.value.cid || track.payload.value.content
      if (!entry.content.equals(contentCID)) {
        return this._add(entry, shouldPin)
      }

      return loadEntryContent(self._ipfs, track)
    },

    _add: async (entry, shouldPin) => {
      await self.put(entry)
      // TODO
      // if (shouldPin) await self._ipfs.pin.add(hash)
      return self.tracks.getFromId(entry.id)
    },

    add: async (content, tags, shouldPin) => {
      const entry = await new TrackEntry().create(self._ipfs, content, shouldPin, tags)
      return self.tracks._add(entry, shouldPin)
    },

    getFromResolverId: async (extractor, id) => {
      const indexEntries = Array.from(self._index._index.track.values())
      const indexEntry = indexEntries.find((entry) => {
        return entry.resolver.find(r => r === `${extractor}:${id}`)
      })

      if (!indexEntry) {
        return null
      }

      return self.tracks.getFromHash(indexEntry.hash)
    },

    getFromId: async (id) => {
      const entry = await self.get(id, 'track')
      return loadEntryContent(self._ipfs, entry)
    },

    getFromHash: async (hash) => {
      const entry = await self._oplog.get(hash)
      return loadEntryContent(self._ipfs, entry)
    },

    del: (id) => {
      const hash = self.del(id, 'track')
      return hash
    }
  }
}
