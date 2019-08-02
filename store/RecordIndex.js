const Log = require('ipfs-log')
const FlexSearch = require('flexsearch')
const { CID } = require('ipfs')

const debounce = (callback, wait) => {
  let timeout = null
  return (...args) => {
    const next = () => callback(...args)
    clearTimeout(timeout)
    timeout = setTimeout(next, wait)
  }
}

class RecordIndex {
  constructor (oplog, cache) {
    this._cacheIndexKey = '_recordStoreIndex'
    this._cacheSearchIndexKey = '_recordStoreSearchIndex'
    this._oplog = oplog
    this._cache = cache
    this._queue = new Map()
    this._throttledProcess = debounce(this._processOne.bind(this), 1)
    this._index = {
      tags: {},
      about: null,
      track: new Map(),
      contact: new Map()
    }
    this._searchIndex = new FlexSearch('speed', {
      async: true,
      doc: {
        id: 'key',
        field: [
          'title',
          'artist',
          'album',
          'resolver'
        ],
        tag: ['tags']
      }
    })
  }

  async save () {
    await this._cache.set(this._cacheIndexKey, this._exportIndex())
    await this._cache.set(this._cacheSearchIndexKey, this._searchIndex.export())
  }

  _exportIndex () {
    let tmp = {
      track: Array.from(this._index.track.entries()),
      contact: Array.from(this._index.contact.entries()),
      tags: this._index.tags,
      about: this._index.about
    }
    return JSON.stringify(tmp)
  }

  _importIndex (str) {
    const idx = JSON.parse(str)
    this._index = {
      tags: idx.tags,
      about: idx.about,
      track: new Map(idx.track),
      contact: new Map(idx.contact)
    }
  }

  async _processOne () {
    const hash = this._queue.keys().next().value
    let entry = this._queue.get(hash)

    // load entry if necessary
    if (!entry.payload) {
      entry = await this._oplog.get(entry)
    }

    // load content from ipfs
    if (CID.isCID(entry.payload.value.content)) {
      entry.payload.value.cid = entry.payload.value.content
      entry.payload.value.contentCID = entry.payload.value.content.toBaseEncodedString('base58btc')
      const dagNode = await this._oplog._storage.dag.get(entry.payload.value.content)
      entry.payload.value.content = dagNode.value
    }

    this.add(entry)

    this.updateTags()
    this.sort()

    this._queue.delete(hash)
    if (this._queue.size) this._throttledProcess()
    else await this.save()
  }

  process (entry) {
    this._queue.set(entry.hash || entry, entry)
    this._throttledProcess()
  }

  hasTag (tag) {
    return this._index.tags.hasOwnProperty(tag)
  }

  has (id, type) {
    return !!this.getEntry(id, type)
  }

  getEntry (id, type) {
    if (type === 'about') {
      return this._index.about
    }

    return this._index[type].get(id)
  }

  getEntryHash (id, type) {
    const entry = this.getEntry(id, type)
    return entry ? entry.hash : null
  }

  add (item) {
    const { key } = item.payload
    const { type } = item.payload.value
    const entry = this.getEntry(key, type)

    if (entry && entry.clock.time > item.clock.time) {
      return
    }

    if (item.payload.op === 'PUT') {
      if (type === 'about') {
        this._index.about = item
        return
      }

      let cache = {
        hash: item.hash,
        clock: item.clock
      }

      if (type === 'track') {
        cache.tags = item.payload.value.tags
        const { resolver } = item.payload.value.content
        cache.resolver = resolver.map(r => `${r.extractor}:${r.id}`)
        this._searchIndex.add({
          key,
          resolver: resolver.map(r => r.fulltitle).join(' '),
          tags: item.payload.value.tags,
          ...item.payload.value.content.tags
        })
      }
      this._index[type].set(key, cache)
    } else if (item.payload.op === 'DEL') {
      this._searchIndex.remove(key)
      this._index[type].delete(key)
    }
  }

  updateTags () {
    this._index.tags = {}
    for (const track of this._index.track.values()) {
      track.tags && track.tags.forEach(t => { this._index.tags[t] = (this._index.tags[t] + 1) || 1 })
    }
  }

  sort () {
    this._index.track = new Map([...this._index.track.entries()].sort((a, b) => Log.Entry.compare(a[1], b[1])))
    this._index.contact = new Map([...this._index.contact.entries()].sort((a, b) => Log.Entry.compare(a[1], b[1])))
  }

  async loadIndex (oplog) {
    this._oplog = oplog
    const idx = await this._cache.get(this._cacheIndexKey)
    if (idx) this._importIndex(idx)

    const searchIdx = await this._cache.get(this._cacheSearchIndexKey)
    if (searchIdx) this._searchIndex.import(searchIdx)

    // Get all Hashes in Index
    const trackHashes = Array.from(this._index.track.values()).map(e => e.hash)
    const contactHashes = Array.from(this._index.contact.values()).map(e => e.hash)
    const queueHashes = Array.from(this._queue.keys())
    const entryHashes = [].concat(trackHashes, contactHashes, queueHashes)

    // queue up entries not already in index or in queue
    for (const [entryHash] of this._oplog._hashIndex) {
      if (!entryHashes.includes(entryHash)) {
        this.process(entryHash)
      }
    }
  }

  async updateIndex (entry) {
    // Get all Hashes in Index + Queue
    const trackHashes = Array.from(this._index.track.values()).map(e => e.hash)
    const contactHashes = Array.from(this._index.contact.values()).map(e => e.hash)
    const queueHashes = Array.from(this._queue.keys())
    const entryHashes = [].concat(trackHashes, contactHashes, queueHashes)

    if (!entryHashes.includes(entry.hash)) {
      if (entry.payload.op === 'PUT' && CID.isCID(entry.payload.value.content)) {
        entry.payload.value.cid = entry.payload.value.content
        entry.payload.value.contentCID = entry.payload.value.content.toBaseEncodedString('base58btc')
        const dagNode = await this._oplog._storage.dag.get(entry.payload.value.content)
        entry.payload.value.content = dagNode.value
      }
      this.add(entry)

      // Build tags Index
      this.updateTags()

      // Re-sort Index
      this.sort()

      // Save to disk
      await this.save()
    }
  }
}

module.exports = RecordIndex
