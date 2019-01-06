'use strict'

const util = require('util')
const tough = require('tough-cookie')
const Store = tough.Store
const permuteDomain = tough.permuteDomain
const betterSqlite3 = require('better-sqlite3') // https://github.com/JoshuaWise/better-sqlite3

const matchPath = url => { // dirty version of https://github.com/salesforce/tough-cookie/blob/master/lib/pathMatch.js
  const urlarr = url.split('/')
  const patharr = []
  const result = ['/']
  for (let i = 0, len = urlarr.length; i < len; i++) {
    if (urlarr[i].length === 0) continue
    patharr.push(urlarr[i])
    result.push('/' + patharr.join('/'))
  }
  return result
}

function CookieStore (path, option = {}) {
  if (!path) throw new Error('path missing')
  this.db = betterSqlite3(path, option.sqlite || {})

  this.option = Object.assign({
    dbname: 'db'
  }, option)

  this.db.prepare(`CREATE TABLE IF NOT EXISTS ${this.option.dbname} (domain TEXT, path TEXT, key TEXT, cookie TEXT)`).run()

  Store.call(this)
}

util.inherits(CookieStore, Store)

exports.CookieStore = CookieStore

// Since it's just a struct in RAM, this Store is synchronous
CookieStore.prototype.synchronous = true

// force a default depth:
CookieStore.prototype.inspect = function () {
  return '{ idx: ' + util.inspect(this.getAllCookies(), false, 2) + ' }'
}

// Use the new custom inspection symbol to add the custom inspect function if available.
if (util.inspect.custom) {
  CookieStore.prototype[util.inspect.custom] = CookieStore.prototype.inspect
}

CookieStore.prototype.findCookie = function (domain, path, key, cb) {
  try {
    const output = this.db.prepare(`SELECT cookie FROM ${this.option.dbname} WHERE domain in ('${domain}') and path = '${path}' and key = '${key}'`).get()
    cb(null, output && tough.fromJSON(output.cookie))
  } catch (err) {
    cb(err, undefined)
  }
}

CookieStore.prototype.findCookies = function (domain, path, cb) {
  if (!domain) return cb(null, [])

  const domains = permuteDomain(domain) || [domain]
  path = matchPath(path)

  try {
    const output = this.db.prepare(`SELECT DISTINCT cookie FROM ${this.option.dbname} WHERE domain in ('${domains.join("', '")}') and path in ('${path.join("', '")}')`).all()
    const results = (output || []).map(x => x && tough.fromJSON(x.cookie))
    cb(null, results)
  } catch (err) {
    cb(err, [])
  }
}

CookieStore.prototype.putCookie = function (cookie, cb) {
  this.db.prepare(`INSERT INTO ${this.option.dbname} (domain, path, key, cookie) VALUES ('${cookie.domain}', '${cookie.path}', '${cookie.key}', json('${JSON.stringify(cookie)}'))`).run()
  cb(null)
}

CookieStore.prototype.updateCookie = function (oldCookie, newCookie, cb) {
  this.db.prepare(`UPDATE ${this.option.dbname} SET cookie = json('${JSON.stringify(newCookie)}') WHERE domain = '${newCookie.domain}' and path = '${newCookie.path}' and key = '${newCookie.key}'`).run()
  cb(null)
}

CookieStore.prototype.removeCookie = function (domain, path, key, cb) {
  this.db.prepare(`DELETE FROM ${this.option.dbname} WHERE domain = '${domain}' and path = '${path}' and key = '${key}'`).run()
  cb(null)
}

CookieStore.prototype.removeCookies = function (domain, path, cb) {
  if (domain) {
    if (path) {
      this.db.prepare(`DELETE FROM ${this.option.dbname} WHERE domain = '${domain}' and path = '${path}'`).run()
    } else {
      this.db.prepare(`DELETE FROM ${this.option.dbname} WHERE domain = '${domain}'`).run()
    }
  }
  cb(null)
}

CookieStore.prototype.removeAllCookies = function (cb) {
  this.db.prepare(`DELETE FROM ${this.option.dbname}`).run()
  cb(null)
}

CookieStore.prototype.getAllCookies = function (cb) {
  try {
    const output = this.db.prepare(`SELECT * FROM ${this.option.dbname}`).all()
    const result = {}
    for (let i = 0, len = output.length; i < len; i++) {
      if (!result[output[i].domain]) result[output[i].domain] = {}
      if (!result[output[i].domain][output[i].path]) result[output[i].domain][output[i].path] = {}
      if (!result[output[i].domain][output[i].path][output[i].key]) result[output[i].domain][output[i].path][output[i].key] = tough.fromJSON(output[i].cookie)
    }
    if (cb instanceof Function) cb(result)
    else return result
  } catch (err) {
    if (cb instanceof Function) cb(err)
    else return err
  }
}
