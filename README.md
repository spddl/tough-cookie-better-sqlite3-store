# tough-cookie-better-sqlite3-store

## Dependencies

- better-sqlite3 ^5.2.1
- tough-cookie ^2.5.0

## Usage
``` js
const path = require('path')
const request = require('request')
const CookieStore = require('tough-cookie-better-sqlite3-store')

const jar = request.jar(new CookieStore(
  path.resolve('cookies.db3'),
  {
    dbname: 'db',
    sqlite: {
      memory: false,
      readonly: false,
      fileMustExist: false,
      timeout: 5000
    }
  }
))

request({
  url: 'http://www.google.com',
  jar: jar
}, (error, response, body) => {
  console.log('error:', error) // Print the error if one occurred
  console.log('statusCode:', response && response.statusCode) // Print the response status code if a response was received
  console.log('body:', body) // Print the HTML for the Google homepage.
})
```