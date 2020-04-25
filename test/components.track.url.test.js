/* global describe it before after */

const assert = require('assert')
const {
  config,
  startRecord
} = require('./utils')

describe('record.components.track', function () {
  this.timeout(config.timeout)
  let record

  before(async () => { record = await startRecord(config.node1) })
  after(async () => record && record.stop())

  describe('record.components.track.addTrackFromUrl', function () {
    let track1
    const urlpath1 = 'https://soundcloud.com/asa-moto101/kifesh?in=deewee-2/sets/asa-moto-playtime-deewee030'
    const urlpath2 = 'https://www.youtube.com/watch?v=a7jdHdR-oF8'

    describe('add', function () {
      it('added with log length of 1', async function () {
        track1 = await record.tracks.addTrackFromUrl(urlpath1)
        const entry = await record._log.tracks.getFromId(track1.id)
        assert.notStrictEqual(track1, undefined)
        assert.strictEqual(track1.type, 'track')
        assert.strictEqual(entry.clock.time, 1)
        assert.strictEqual(track1.content.audio.duration, 276.34938775510204)
      })

      it('contentCID', function () {
        assert.strictEqual(track1.contentCID, 'zBwWX7R8Kj9YFo6i6PaX9Ez15RtR2okKf85DXrAur9Bdsp2DWNLZJBVfi2X8hbAiDpuEYSZAYyi2JenC7buH89FRKGewk')
      })

      it('audio file hash', function () {
        assert.strictEqual(track1.content.hash, 'QmSn3parzLeoSEThmfJNbRPtfMt91QQWCPjWdrP9x3WxS3')
      })
    })

    describe('get', function () {
      let track
      before(async () => { track = await record.tracks.get({ logAddress: record.address, trackId: track1.id }) })

      it('contentCID', function () {
        assert.strictEqual(track.contentCID, track1.contentCID)
      })

      it('audio file hash', function () {
        assert.strictEqual(track.content.hash, track1.content.hash)
      })
    })

    describe('list', function () {
      let tracks
      before(async () => { tracks = await record.tracks.list(record.address) })

      it('has one track', function () {
        assert.strictEqual(tracks.length, 1)
      })

      it('contentCID', function () {
        assert.strictEqual(tracks[0].contentCID, track1.contentCID)
      })

      it('audio file hash', function () {
        assert.strictEqual(tracks[0].content.hash, track1.content.hash)
      })
    })

    describe('add duplicate', function () {
      let track
      before(async () => { track = await record.tracks.addTrackFromUrl(urlpath1) })

      it('duplicate detected', async function () {
        const entry = await record._log.tracks.getFromId(track1.id)
        assert.notStrictEqual(track1, undefined)
        assert.strictEqual(track1.type, 'track')
        assert.strictEqual(entry.clock.time, 1)
      })

      it('list includes one track', async function () {
        const tracks = await record.tracks.list(record.address)
        assert.strictEqual(tracks.length, 1)
      })

      it('contentCID', function () {
        assert.strictEqual(track.contentCID, track1.contentCID)
      })

      it('audio file hash', function () {
        assert.strictEqual(track.content.hash, track1.content.hash)
      })
    })

    describe('remove track', function () {
      before(async () => { await record.tracks.remove(track1.id) })

      it('list doesnt include track', async function () {
        const tracks = await record.tracks.list(record.address)
        assert.strictEqual(tracks.length, 0)
      })
    })

    describe('re-add track', function () {
      let track
      before(async () => { track = await record.tracks.addTrackFromUrl(urlpath1) })

      it('track added', async function () {
        const entry = await record._log.tracks.getFromId(track.id)
        assert.notStrictEqual(track, undefined)
        assert.strictEqual(track.type, 'track')
        assert.strictEqual(entry.clock.time, 3)
        assert.strictEqual(track.content.audio.duration, 276.34938775510204)
      })

      it('contentCID', function () {
        assert.strictEqual(track.contentCID, 'zBwWX7R8Kj9YFo6i6PaX9Ez15RtR2okKf85DXrAur9Bdsp2DWNLZJBVfi2X8hbAiDpuEYSZAYyi2JenC7buH89FRKGewk')
      })

      it('audio file hash', function () {
        assert.strictEqual(track.content.hash, 'QmSn3parzLeoSEThmfJNbRPtfMt91QQWCPjWdrP9x3WxS3')
      })
    })

    describe('add new track', function () {
      let track
      before(async () => { track = await record.tracks.addTrackFromUrl(urlpath2) })

      it('track added', async function () {
        const entry = await record._log.tracks.getFromId(track.id)
        assert.notStrictEqual(track, undefined)
        assert.strictEqual(track.type, 'track')
        assert.strictEqual(entry.clock.time, 4)
        assert.strictEqual(track.content.audio.duration, 560.9186167800453)
      })

      it('contentCID', function () {
        assert.strictEqual(track.contentCID, 'zBwWX9o3vH3G6xbwv8XaYxqtAYeCarBSy4fECpixWxTRKAsBQXG2Fv3x99rvN89M5XMK1tSpxFj8cSm6BX9sKuauaLN4w')
      })

      it('audio file hash', function () {
        assert.strictEqual(track.content.hash, 'QmYzoASpXMiUVs7nAq7vdga31N5ZmsSMEFzwvrPyioT7yC')
      })
    })
  })
})
