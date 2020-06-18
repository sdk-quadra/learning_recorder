#!/usr/bin/env node

'use strict'

const colors = require('colors/safe')
const emoji = require('node-emoji')

const moment = require('moment')
const readline = require('readline')
const cliSelect = require('cli-select')
const chalk = require('chalk')

const genres = ['ruby', 'javascript', 'infla', 'html/css']
const wday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const proHours = 10000
const ljustDigit = 15
const rjustDigit = 5
const datesRange = 7
const displayLimit = 20
const strRepeatTime = 60

class LearningRecorder {
  constructor () {
    this.fileName = 'learning.sqlite3'
    this.sqlite3 = require('sqlite3').verbose()
    this.db = new this.sqlite3.Database(this.fileName)
    this.db.run(
      `CREATE TABLE IF NOT EXISTS learning 
      (learning_date TEXT, genre TEXT, learning_time TEXT,
       created_at TEXT, updated_at TEXT)`)
    this.argv = require('minimist')(process.argv.slice(2))
  }

  async generateDates () {
    const dates = []
    const promise = new Promise((resolve) => {
      for (let i = 0; i <= datesRange; i++) {
        const xDay = moment().subtract(i, 'days').format()
        dates.push(xDay)
      }
      resolve(dates)
    })
    const result = await promise
    const response = await this.selectItems(result)
    return response
  }

  async readRows () {
    try {
      const promise = new Promise((resolve) => {
        this.db.serialize(() => {
          this.db.all(
            `SELECT learning_date, genre, learning_time FROM learning
             WHERE learning_date >= datetime('now', 'localtime' ,'-${datesRange} days') 
             ORDER BY learning_date DESC LIMIT ${displayLimit}`,
            (err, rows) => {
              if (err) console.log(err)
              const shapedRows = this.shapeRows(rows)
              resolve(shapedRows)
            })
        })
      })
      const result = await promise
      if (result.length < 1) process.exit(1)

      const response = await this.selectItems(result)
      return response
    } catch (e) {
      console.log(e)
    }
  }

  shapeRows (rows) {
    const shapedRows = []
    for (const key in rows) {
      rows[key].learning_date = this.ljust(moment(rows[key].learning_date).format('Y/M/D'), ljustDigit)
      rows[key].genre = this.ljust(rows[key].genre, ljustDigit)
      rows[key].learning_time = this.rjust(rows[key].learning_time, rjustDigit) + ' minutes'
      shapedRows.push(rows[key].learning_date + rows[key].genre + rows[key].learning_time)
    }
    return shapedRows
  }

  async selectItems (data) {
    const select = this.cliSelect(data)
      .then((response) => {
        return response
      }).catch(() => {
        console.log('cancelled')
        process.exit(1)
      })
    const result = await select
    return result
  }

  cliSelect (data) {
    const renderedValue = cliSelect({
      values: data,
      selected: '(○)',
      unselected: '( )',
      valueRenderer: (value, selected) => {
        value = this.convertDateFormat(value)
        if (selected) {
          return chalk.blue(value)
        }
        return value
      }
    })
    return renderedValue
  }

  convertDateFormat (value) {
    if (moment(value, 'YY-MM-DD').isValid()) {
      const xday = moment(value).format('M/D')
      const xdayWday = moment(value).weekday()
      value = xday + ' (' + wday[xdayWday] + ')'
    }
    return value
  }

  async stdin () {
    const input = this.createInterface()
      .then((response) => {
        return response
      })
      .catch((err) => {
        console.log(err)
        console.log('Please re-type.')
      })
    const result = await input
    return result
  }

  createInterface () {
    const learningTime = new Promise((resolve, reject) => {
      var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      })
      rl.question('Enter your study time in minutes (ex.1 hour and 10 minutes, enter 70)\n',
        answer => {
          if (parseInt(answer) > 1440) {
            reject(new Error('It’s exceeding the time on a day.'))
          } else if (!answer.match(/^\d*$/g) || answer === '') {
            reject(new Error('Please enter in half-width numbers.'))
          } else {
            resolve(answer)
          }
          rl.close()
        })
    })
    return learningTime
  }

  show () {
    console.log(colors.rainbow('/'.repeat(strRepeatTime)), '\n')
    console.log('Your total study time (hours)', '\n')
    this.db.serialize(() => {
      this.db.each(
        `SELECT genre, SUM(learning_time)
         FROM learning GROUP BY genre`,
        (err, rows) => {
          if (err) console.log(err)
          for (const key in rows) {
            if (key === 'SUM(learning_time)') {
              rows[key] = this.convertInHour(rows[key])
            }
            process.stdout.write(this.ljust(String(rows[key]), ljustDigit))
          }
          console.log('')
        }
      )
      this.countTotalTime()
    })
  }

  countTotalTime () {
    this.db.each('SELECT SUM(learning_time) FROM learning',
      (err, rows) => {
        if (err) console.log(err)
        console.log('----------------------------')
        for (const key in rows) {
          if (key === 'SUM(learning_time)') {
            rows[key] = this.convertInHour(rows[key])
          }
          console.log(this.ljust('total', ljustDigit) + rows[key] + ' hours', '\n')
          const remainTime = (proHours - rows[key]).toString()
          console.log(
            'Your time of study remaining to be pro is ' +
             colors.rainbow(remainTime) + ' hours.')
          console.log(
            'Keep studying is the key to success!!' +
             emoji.get('dango') + emoji.get('sunglasses') + emoji.get('sushi'), '\n')
        }
        console.log(colors.rainbow('/'.repeat(strRepeatTime)))
      })
  }

  showDairy () {
    console.log('Your total study time in a day (hours)', '\n')

    this.db.serialize(() => {
      this.db.each(
        `SELECT strftime('%Y-%m-%d', learning_date),
         GROUP_CONCAT(distinct genre), SUM(learning_time) 
         FROM learning GROUP BY strftime('%Y-%m-%d', learning_date) 
         ORDER BY learning_date DESC`,
        (err, rows) => {
          if (err) console.log(err)
          for (const key in rows) {
            if (key === 'SUM(learning_time)') {
              rows[key] = this.convertInHour(rows[key])
            }
            process.stdout.write(this.ljust(String(rows[key]), ljustDigit) + ' ')
          }
          console.log('')
        }
      )
    })
  }

  async create () {
    console.log('Choose a date of learning.')
    const dates = await this.generateDates()
    console.log(colors.yellow(this.convertDateFormat(dates.value)))

    console.log('Choose a genre of learning.')
    const genre = await this.selectItems(genres)
    console.log(colors.yellow(genre.value))

    var stdin
    while (stdin === undefined) {
      stdin = await this.stdin()
    }
    console.log(colors.yellow(stdin))

    const property = {}
    property.date = dates.value
    property.genre = genre.value
    property.learning_time = stdin

    await this.insertRow(property)
    console.log(colors.yellow('Created successfully!'))
  }

  async edit () {
    console.log('Choose a date to edit.')
    const row = await this.readRows()
    console.log(colors.yellow(row.value))

    console.log('Choose a date of learning.')
    const dates = await this.generateDates()
    console.log(colors.yellow(this.convertDateFormat(dates.value)))

    console.log('Choose a genre of learning.')
    const genre = await this.selectItems(genres)
    console.log(colors.yellow(genre.value))

    var stdin
    while (stdin === undefined) {
      stdin = await this.stdin()
    }
    console.log(colors.yellow(stdin))

    const property = {}
    property.date = dates.value
    property.genre = genre.value
    property.learning_time = stdin

    await this.updateRow(property, row)
    console.log(colors.yellow('Edited successfully!'))
  }

  async delete () {
    const row = await this.readRows()
    await this.deleteRow(row)
    console.log(colors.yellow('Deleted successfully'))
  }

  insertRow (property) {
    try {
      this.db.serialize(() => {
        const stmt = this.db.prepare(
          `INSERT INTO learning (learning_date, genre, learning_time,
           created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
          function (err, rows) {
            if (err) console.log(err)
          }
        )
        stmt.run(property.date, property.genre, property.learning_time, property.date, property.date)
        stmt.finalize()
      })
    } catch (e) {
      console.log(e)
    }
  }

  updateRow (property, response) {
    const stmt = this.db.prepare(
      `UPDATE learning
       SET learning_date = (?), genre = (?), learning_time = (?), 
       updated_at = datetime('now', 'localtime')
       WHERE rowid = (SELECT rowid FROM learning ORDER BY learning_date DESC 
       LIMIT 1 OFFSET (?))`
    )
    stmt.run(property.date, property.genre, property.learning_time, response.id)
    stmt.finalize()
  }

  deleteRow (response) {
    const stmt = this.db.prepare(
      `DELETE FROM learning
       WHERE rowid = (SELECT rowid FROM learning 
       ORDER BY learning_date DESC LIMIT 1 OFFSET (?))`
    )
    stmt.run(response.id)
    stmt.finalize()
  }

  convertInHour (minutes) {
    const digitNumber = 1
    return Math.round((minutes / 60) * (10 ** digitNumber)) / (10 ** digitNumber)
  }

  ljust (string, width, padding) {
    padding = padding || ' '
    padding = padding.substr(0, 1)

    if (string.length < width) {
      return string + padding.repeat(width - string.length)
    } else {
      return string
    }
  }

  rjust (string, width, padding) {
    padding = padding || ' '
    padding = padding.substr(0, 1)

    if (string.length < width) {
      return padding.repeat(width - string.length) + string
    } else {
      return string
    }
  }

  main () {
    if ((run.argv._).includes('create')) run.create()
    else if ((run.argv._).includes('show') && (run.argv.d)) run.showDairy()
    else if ((run.argv._).includes('show')) run.show()
    else if ((run.argv._).includes('edit')) run.edit()
    else if ((run.argv._).includes('delete')) run.delete()
    else run.show()
  }
}

const run = new LearningRecorder()
run.main()
